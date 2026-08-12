'use strict';

const crypto = require('node:crypto');
const { Prisma } = require('../../../../../lib/prisma');
const { createCustomerMoneyApplication } = require('../../application/createCustomerMoneyApplicationService');
const { createCustomerMoneyLedger } = require('../../ledger/createCustomerMoneyLedgerService');
const { updateCustomerMoneyBalance } = require('../../balance/updateCustomerMoneyBalanceService');
const {
  calculateAvailableCustomerMoney,
  consumeCustomerMoneySources,
} = require('../../balance/customerMoneySourcePoolService');
const {
  acquireCustomerMoneyTransactionLock,
} = require('../../shared/customerMoneyTransactionLock');
const {
  projectSalePaymentStatus,
} = require('../../../sales/completion/services/salePaymentPostingService');
const { resolveFinancialCustomerGroup } = require('../../../customer/financial-group/customerFinancialGroupResolver');
const { buildActiveCreditReceivableWhere } = require('../../../sales/shared/creditReceivableAuthority');
const {
  createSettlementConsolidatedDelivery,
  loadSettlementGeneratedDocument,
} = require('../../../finance/combined-billing/create/createSettlementConsolidatedDelivery');

const money = (value) => new Prisma.Decimal(String(value ?? 0));
const asNumber = (value) => Number(value || 0);
const SETTLEMENT_TRANSACTION_OPTIONS = Object.freeze({ maxWait: 10000, timeout: 30000 });

const derivePaymentStatus = ({ totalAmount, paidAmount }) => {
  const total = money(totalAmount);
  const paid = money(paidAmount);
  if (paid.greaterThanOrEqualTo(total)) return 'PAID';
  if (paid.greaterThan(0)) return 'PARTIALLY_PAID';
  return 'UNPAID';
};

const buildSettlementRequestHash = (command) => {
  const lines = [...command.lines]
    .map((line) => ({
      saleId: line.saleId,
      saleItemId: line.saleItemId,
      lineType: line.lineType,
      amount: Number(Number(line.amount).toFixed(2)),
    }))
    .sort((left, right) => (
      left.saleId - right.saleId
      || left.lineType.localeCompare(right.lineType)
      || left.saleItemId - right.saleItemId
      || left.amount - right.amount
    ));
  return crypto.createHash('sha256').update(JSON.stringify({
    customerId: command.customerId,
    note: command.note || null,
    lines,
  })).digest('hex');
};

const acquireSettlementCommandLock = async (tx, commandKey) => {
  if (!commandKey || !tx?.$queryRaw) return;
  const digest = crypto.createHash('sha256').update(commandKey).digest();
  const lockId = digest.readInt32BE(0);
  await tx.$queryRaw`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(${-1005}::int, ${lockId}::int)) AS advisory_lock`;
};

const acquireCustomerMoneySettlementLock = (tx, branchId, customerId, ownerId = null) => {
  const normalizedOwnerId = Number(ownerId);
  if (Number.isInteger(normalizedOwnerId) && normalizedOwnerId > 0) {
    return acquireCustomerMoneyTransactionLock(tx, normalizedOwnerId);
  }
  return acquireCustomerMoneyTransactionLock(tx, customerId, branchId);
};

const buildCode = async (tx, branchId, settledAt = new Date()) => {
  await tx.$queryRaw`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(${-1002}::int, ${Number(branchId)}::int)) AS advisory_lock`;
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

const selectSaleIdentity = (tx, saleId, branchId, customerIds) => tx.sale.findFirst({
  where: {
    id: saleId,
    branchId,
    customerId: { in: customerIds },
    isCredit: true,
    status: { not: 'CANCELLED' },
  },
  select: { id: true },
});

const selectSale = (tx, saleId, branchId, customerIds) => tx.sale.findFirst({
  where: {
    id: saleId,
    ...buildActiveCreditReceivableWhere({ branchId, customerIds }),
  },
  select: {
    id: true,
    code: true,
    customerId: true,
    officialDocumentNumber: true,
    soldAt: true,
    totalAmount: true,
    paidAmount: true,
    customer: {
      select: { id: true, name: true, companyName: true, departmentName: true, taxId: true },
    },
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

const distributeSourcesAcrossLines = (prepared, sourceChunks) => {
  const sources = sourceChunks.map((source) => ({ ...source, remainingAmount: money(source.amount) }));
  const allocations = [];
  let sourceIndex = 0;

  for (const item of prepared) {
    let lineRemaining = money(item.requested.amount);
    while (lineRemaining.greaterThan(0)) {
      const source = sources[sourceIndex];
      if (!source) {
        const error = new Error('ไม่สามารถจับคู่แหล่ง Customer Money กับรายการตัดยอดได้ครบ');
        error.code = 'CUSTOMER_MONEY_ALLOCATION_INCOMPLETE';
        error.statusCode = 409;
        throw error;
      }
      if (source.remainingAmount.lessThanOrEqualTo(0)) {
        sourceIndex += 1;
        continue;
      }
      const amount = Prisma.Decimal.min(lineRemaining, source.remainingAmount);
      allocations.push({ item, sourceType: source.sourceType, sourceId: source.sourceId, amount });
      lineRemaining = lineRemaining.minus(amount);
      source.remainingAmount = source.remainingAmount.minus(amount);
      if (source.remainingAmount.lessThanOrEqualTo(0)) sourceIndex += 1;
    }
  }

  return allocations;
};

const loadSettlementCreateResult = async (tx, settlementId, {
  branchId,
  customerId,
  financialGroup = null,
  idempotentReplay = false,
}) => {
  const [fresh, availableAmount, generatedDocument] = await Promise.all([
    tx.customerMoneySettlement.findFirst({
      where: { id: settlementId, branchId, customerId, settlementType: 'DELIVERY_CREDIT' },
      include: {
        customer: { select: { id: true, name: true, companyName: true, departmentName: true, taxId: true } },
        lines: { orderBy: [{ saleId: 'asc' }, { id: 'asc' }], include: { application: true } },
      },
    }),
    calculateAvailableCustomerMoney(tx, { branchId, customerId, financialGroup }),
    loadSettlementGeneratedDocument(tx, { branchId, settlementId }),
  ]);
  if (!fresh) {
    const error = new Error('ไม่พบเอกสารตัดยอดสำหรับคำสั่งเดิม');
    error.code = 'SETTLEMENT_REPLAY_NOT_FOUND';
    error.statusCode = 409;
    throw error;
  }
  return {
    ...fresh,
    totalAmount: asNumber(fresh.totalAmount),
    customerMoneyBalance: asNumber(availableAmount),
    generatedDocument,
    idempotentReplay,
  };
};

const createDeliveryCreditSettlement = async ({ prisma, command }) => prisma.$transaction(async (tx) => {
  const group = await resolveFinancialCustomerGroup(tx, { customerId: command.customerId, branchId: command.branchId });
  const requestHash = command.commandKey ? buildSettlementRequestHash(command) : null;
  if (command.commandKey) {
    await acquireSettlementCommandLock(tx, command.commandKey);
    const existingCommand = await tx.customerMoneySettlementCommand.findUnique({
      where: {
        branchId_commandKey: {
          branchId: command.branchId,
          commandKey: command.commandKey,
        },
      },
      select: { customerId: true, requestHash: true, settlementId: true },
    });
    if (existingCommand) {
      if (existingCommand.customerId !== group.ownerId || existingCommand.requestHash !== requestHash) {
        const error = new Error('X-Idempotency-Key นี้เคยถูกใช้กับคำสั่งตัดยอดอื่นแล้ว');
        error.code = 'IDEMPOTENCY_KEY_REUSED';
        error.statusCode = 409;
        throw error;
      }
      await acquireCustomerMoneySettlementLock(tx, command.branchId, command.customerId, group.ownerId);
      return loadSettlementCreateResult(tx, existingCommand.settlementId, {
        branchId: command.branchId,
        customerId: group.ownerId,
        financialGroup: group,
        idempotentReplay: true,
      });
    }
  }

  await acquireCustomerMoneySettlementLock(tx, command.branchId, command.customerId, group.ownerId);
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

  const requestedTotal = command.lines.reduce((sum, line) => sum.plus(money(line.amount)), money(0));
  const available = await calculateAvailableCustomerMoney(tx, {
    branchId: command.branchId,
    customerId: command.customerId,
    financialGroup: group,
  });
  if (available.lessThanOrEqualTo(0)) {
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

  const saleIds = [...new Set(command.lines.map((line) => line.saleId))]
    .sort((left, right) => left - right);
  const sales = new Map();
  for (const saleId of saleIds) {
    const identity = await selectSaleIdentity(tx, saleId, command.branchId, group.memberIds);
    if (!identity) {
      const error = new Error('ไม่พบใบส่งของเครดิตที่ยังใช้งานสำหรับลูกค้ารายนี้');
      error.code = 'DELIVERY_CREDIT_NOT_ELIGIBLE';
      error.statusCode = 409;
      throw error;
    }

    await projectSalePaymentStatus(tx, saleId);
    const sale = await selectSale(tx, saleId, command.branchId, group.memberIds);
    if (!sale) {
      const error = new Error('ใบส่งของเครดิตนี้ไม่มีรายการค้างที่สามารถตัดยอดได้แล้ว');
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
    const alreadyAppliedAmount = money(alreadyApplied._sum.appliedAmount);
    const remainingLine = snapshot.lineAmount.minus(alreadyAppliedAmount);
    if (money(requested.amount).greaterThan(remainingLine)) {
      const error = new Error('ยอดที่เลือกมากกว่ายอดคงเหลือของรายการสินค้า');
      error.code = 'SETTLEMENT_LINE_EXCEEDS_REMAINING';
      error.statusCode = 409;
      throw error;
    }
    prepared.push({
      requested,
      sale,
      snapshot,
      alreadyAppliedAmount,
      remainingLine,
      completesLine: money(requested.amount).greaterThanOrEqualTo(remainingLine),
    });
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
      customerId: group.ownerId,
      settlementType: 'DELIVERY_CREDIT',
      totalAmount: requestedTotal,
      status: 'ACTIVE',
      settledAt,
      note: command.note,
      createdById: command.createdById,
    },
  });

  const sourceChunks = await consumeCustomerMoneySources(tx, {
    branchId: command.branchId,
    customerId: command.customerId,
    amount: requestedTotal,
    financialGroup: group,
  });
  const allocations = distributeSourcesAcrossLines(prepared, sourceChunks);

  for (const allocation of allocations) {
    const { item } = allocation;
    const application = await createCustomerMoneyApplication({
      client: tx,
      data: {
        branchId: command.branchId,
        customerId: group.ownerId,
        sourceType: allocation.sourceType,
        sourceId: allocation.sourceId,
        targetType: 'DELIVERY_CREDIT',
        targetId: item.sale.id,
        amount: allocation.amount,
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
        appliedAmount: allocation.amount,
      },
    });

    await createCustomerMoneyLedger({
      client: tx,
      data: {
        branchId: command.branchId,
        customerId: group.ownerId,
        applicationId: application.id,
        eventType: 'MONEY_APPLIED',
        amount: allocation.amount,
        direction: 'DEBIT',
        referenceType: 'DELIVERY_CREDIT_SETTLEMENT',
        referenceId: settlement.id,
        createdById: command.createdById,
      },
    });
  }

  for (const saleId of perSale.keys()) {
    await projectSalePaymentStatus(tx, saleId);
  }

  await createSettlementConsolidatedDelivery({
    tx,
    branchId: command.branchId,
    employeeId: command.createdById,
    settlementId: settlement.id,
    customerId: group.ownerId,
    prepared,
    note: command.note,
  });

  const nextBalance = await calculateAvailableCustomerMoney(tx, {
    branchId: command.branchId,
    customerId: group.ownerId,
    financialGroup: group,
  });
  await updateCustomerMoneyBalance({
    client: tx,
    branchId: command.branchId,
    customerId: group.ownerId,
    availableAmount: nextBalance,
  });

  if (command.commandKey) {
    await tx.customerMoneySettlementCommand.create({
      data: {
        branchId: command.branchId,
        customerId: group.ownerId,
        commandKey: command.commandKey,
        requestHash,
        settlementId: settlement.id,
      },
    });
  }

  return loadSettlementCreateResult(tx, settlement.id, {
    branchId: command.branchId,
    customerId: group.ownerId,
    financialGroup: group,
  });
}, SETTLEMENT_TRANSACTION_OPTIONS);

module.exports = {
  createDeliveryCreditSettlement,
  derivePaymentStatus,
  buildSettlementRequestHash,
  acquireSettlementCommandLock,
  acquireCustomerMoneySettlementLock,
  selectSaleIdentity,
  distributeSourcesAcrossLines,
  loadSettlementCreateResult,
  SETTLEMENT_TRANSACTION_OPTIONS,
};
