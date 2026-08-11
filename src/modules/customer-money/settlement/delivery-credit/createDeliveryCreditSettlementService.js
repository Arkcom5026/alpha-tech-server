'use strict';

const { Prisma } = require('../../../../../lib/prisma');
const { createCustomerMoneyApplication } = require('../../application/createCustomerMoneyApplicationService');
const { createCustomerMoneyLedger } = require('../../ledger/createCustomerMoneyLedgerService');
const { updateCustomerMoneyBalance } = require('../../balance/updateCustomerMoneyBalanceService');

const money = (value) => new Prisma.Decimal(String(value ?? 0));
const asNumber = (value) => Number(value || 0);

const derivePaymentStatus = ({ totalAmount, paidAmount }) => {
  const total = money(totalAmount);
  const paid = money(paidAmount);
  if (paid.greaterThanOrEqualTo(total)) return 'PAID';
  if (paid.greaterThan(0)) return 'PARTIALLY_PAID';
  return 'UNPAID';
};

const acquireCustomerMoneySettlementLock = (tx, branchId, customerId) => tx.$queryRaw`
  SELECT pg_advisory_xact_lock(${Number(branchId)}, ${Number(customerId)})
`;

const buildCode = async (tx, branchId, settledAt = new Date()) => {
  const yy = String(settledAt.getFullYear()).slice(-2);
  const mm = String(settledAt.getMonth() + 1).padStart(2, '0');
  const dd = String(settledAt.getDate()).padStart(2, '0');
  const prefix = `CMS-${yy}${mm}${dd}-`;
  const count = await tx.customerMoneySettlement.count({ where: { branchId, code: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, '0')}`;
};

const ensureEmployee = async (tx, branchId, employeeId) => {
  const employee = await tx.employeeProfile.findFirst({
    where: { id: employeeId, branchId, active: true, approved: true },
    select: { id: true },
  });
  if (!employee) {
    const error = new Error('ไม่พบพนักงานผู้ทำรายการในสาขานี้');
    error.code = 'EMPLOYEE_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }
};

const selectSale = (tx, saleId, branchId, customerId) => tx.sale.findFirst({
  where: {
    id: saleId,
    branchId,
    customerId,
    isCredit: true,
    status: { not: 'CANCELLED' },
    statusPayment: { in: ['UNPAID', 'PARTIALLY_PAID'] },
  },
  select: {
    id: true,
    code: true,
    totalAmount: true,
    paidAmount: true,
    items: {
      select: {
        id: true,
        basePrice: true,
        discount: true,
        price: true,
        documentDescription: true,
        stockItem: { select: { product: { select: { name: true } } } },
      },
    },
    simpleItems: {
      select: {
        id: true,
        quantity: true,
        basePrice: true,
        discount: true,
        price: true,
        documentDescription: true,
        product: { select: { name: true } },
      },
    },
  },
});

const lineSnapshot = (sale, requested) => {
  const source = requested.lineType === 'STOCK'
    ? sale.items.find((item) => item.id === requested.saleItemId)
    : sale.simpleItems.find((item) => item.id === requested.saleItemId);
  if (!source) {
    const error = new Error('ไม่พบรายการสินค้าในใบส่งของที่เลือก');
    error.code = 'SALE_ITEM_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }
  return {
    description: source.documentDescription || source.stockItem?.product?.name || source.product?.name || 'สินค้า',
    quantity: requested.lineType === 'STOCK' ? money(1) : money(source.quantity),
    unitAmount: money(source.basePrice),
    lineAmount: money(source.price),
  };
};

const createDeliveryCreditSettlement = async ({ prisma, command }) => prisma.$transaction(async (tx) => {
  await acquireCustomerMoneySettlementLock(tx, command.branchId, command.customerId);
  await ensureEmployee(tx, command.branchId, command.createdById);

  const customer = await tx.customerProfile.findFirst({
    where: { id: command.customerId, branchId: command.branchId },
    select: { id: true },
  });
  if (!customer) {
    const error = new Error('ไม่พบลูกค้าในสาขานี้');
    error.code = 'CUSTOMER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const balance = await tx.customerMoneyBalance.findUnique({
    where: { branchId_customerId: { branchId: command.branchId, customerId: command.customerId } },
    select: { id: true, availableAmount: true },
  });
  const available = money(balance?.availableAmount);
  const requestedTotal = command.lines.reduce((sum, line) => sum.plus(money(line.amount)), money(0));
  if (!balance || available.lessThanOrEqualTo(0)) {
    const error = new Error('ลูกค้าไม่มี Customer Money ที่พร้อมใช้');
    error.code = 'CUSTOMER_MONEY_NOT_AVAILABLE';
    error.statusCode = 409;
    throw error;
  }
  if (requestedTotal.greaterThan(available)) {
    const error = new Error('ยอดตัดชำระมากกว่า Customer Money ที่พร้อมใช้');
    error.code = 'INSUFFICIENT_CUSTOMER_MONEY';
    error.statusCode = 409;
    throw error;
  }

  const saleIds = [...new Set(command.lines.map((line) => line.saleId))];
  const sales = new Map();
  for (const saleId of saleIds) {
    const sale = await selectSale(tx, saleId, command.branchId, command.customerId);
    if (!sale) {
      const error = new Error('ไม่พบใบส่งของเครดิตที่ยังค้างสำหรับลูกค้ารายนี้');
      error.code = 'DELIVERY_CREDIT_NOT_ELIGIBLE';
      error.statusCode = 409;
      throw error;
    }
    sales.set(saleId, sale);
  }

  const prepared = [];
  for (const requested of command.lines) {
    const sale = sales.get(requested.saleId);
    const snapshot = lineSnapshot(sale, requested);
    const alreadyApplied = await tx.customerMoneySettlementLine.aggregate({
      where: {
        saleId: requested.saleId,
        saleItemType: requested.lineType,
        saleItemId: requested.saleItemId,
        settlement: { status: 'ACTIVE', settlementType: 'DELIVERY_CREDIT' },
      },
      _sum: { appliedAmount: true },
    });
    const remainingLine = snapshot.lineAmount.minus(money(alreadyApplied._sum.appliedAmount));
    if (money(requested.amount).greaterThan(remainingLine)) {
      const error = new Error('ยอดที่เลือกมากกว่ายอดคงเหลือของรายการสินค้า');
      error.code = 'SETTLEMENT_LINE_EXCEEDS_REMAINING';
      error.statusCode = 409;
      throw error;
    }
    prepared.push({ requested, sale, snapshot });
  }

  const perSale = new Map();
  for (const item of prepared) {
    perSale.set(item.sale.id, (perSale.get(item.sale.id) || money(0)).plus(money(item.requested.amount)));
  }
  for (const [saleId, amount] of perSale.entries()) {
    const sale = sales.get(saleId);
    const outstanding = money(sale.totalAmount).minus(money(sale.paidAmount));
    if (amount.greaterThan(outstanding)) {
      const error = new Error('ยอดตัดชำระมากกว่ายอดค้างของใบส่งของ');
      error.code = 'SETTLEMENT_EXCEEDS_SALE_OUTSTANDING';
      error.statusCode = 409;
      throw error;
    }
  }

  const settledAt = new Date();
  const code = await buildCode(tx, command.branchId, settledAt);
  const settlement = await tx.customerMoneySettlement.create({
    data: {
      code,
      branchId: command.branchId,
      customerId: command.customerId,
      settlementType: 'DELIVERY_CREDIT',
      totalAmount: requestedTotal,
      status: 'ACTIVE',
      settledAt,
      note: command.note,
      createdById: command.createdById,
    },
  });

  for (const item of prepared) {
    const application = await createCustomerMoneyApplication({
      client: tx,
      data: {
        branchId: command.branchId,
        customerId: command.customerId,
        sourceType: 'CUSTOMER_MONEY_BALANCE',
        sourceId: balance.id,
        targetType: 'DELIVERY_CREDIT',
        targetId: item.sale.id,
        amount: money(item.requested.amount),
        status: 'APPLIED',
        appliedAt: settledAt,
        createdById: command.createdById,
      },
    });

    await tx.customerMoneySettlementLine.create({
      data: {
        settlementId: settlement.id,
        applicationId: application.id,
        saleId: item.sale.id,
        saleCode: item.sale.code,
        saleItemType: item.requested.lineType,
        saleItemId: item.requested.saleItemId,
        description: item.snapshot.description,
        quantity: item.snapshot.quantity,
        unitAmount: item.snapshot.unitAmount,
        lineAmount: item.snapshot.lineAmount,
        appliedAmount: money(item.requested.amount),
      },
    });

    await createCustomerMoneyLedger({
      client: tx,
      data: {
        branchId: command.branchId,
        customerId: command.customerId,
        applicationId: application.id,
        eventType: 'MONEY_APPLIED',
        amount: money(item.requested.amount),
        direction: 'DEBIT',
        referenceType: 'DELIVERY_CREDIT_SETTLEMENT',
        referenceId: settlement.id,
        createdById: command.createdById,
      },
    });
  }

  for (const [saleId, applied] of perSale.entries()) {
    const sale = sales.get(saleId);
    const nextPaid = money(sale.paidAmount).plus(applied);
    await tx.sale.update({
      where: { id: saleId },
      data: {
        paidAmount: nextPaid,
        statusPayment: derivePaymentStatus({ totalAmount: sale.totalAmount, paidAmount: nextPaid }),
      },
    });
  }

  const nextBalance = available.minus(requestedTotal);
  await updateCustomerMoneyBalance({
    client: tx,
    branchId: command.branchId,
    customerId: command.customerId,
    availableAmount: nextBalance,
  });

  const fresh = await tx.customerMoneySettlement.findUnique({
    where: { id: settlement.id },
    include: {
      customer: { select: { id: true, name: true, companyName: true, taxId: true } },
      lines: { orderBy: [{ saleId: 'asc' }, { id: 'asc' }], include: { application: true } },
    },
  });
  return {
    ...fresh,
    totalAmount: asNumber(fresh.totalAmount),
    customerMoneyBalance: asNumber(nextBalance),
  };
});

module.exports = { createDeliveryCreditSettlement, derivePaymentStatus, acquireCustomerMoneySettlementLock };
