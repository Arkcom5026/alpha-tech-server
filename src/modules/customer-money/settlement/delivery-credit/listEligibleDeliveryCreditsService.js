'use strict';

const {
  calculateAvailableCustomerMoney,
} = require('../../balance/customerMoneySourcePoolService');
const { resolveFinancialCustomerGroup } = require('../../../customer/financial-group/customerFinancialGroupResolver');

const money = (value) => Number(value || 0);
const outstanding = (sale) => Math.max(0, Number((money(sale.totalAmount) - money(sale.paidAmount)).toFixed(2)));

const mapStockLine = (item) => ({
  lineType: 'STOCK',
  saleItemId: item.id,
  description: item.documentDescription || item.stockItem?.product?.name || 'สินค้า',
  quantity: 1,
  unitAmount: money(item.basePrice),
  discountAmount: money(item.discount),
  lineAmount: money(item.price),
  barcode: item.stockItem?.barcode || null,
});

const mapSimpleLine = (item) => ({
  lineType: 'SIMPLE',
  saleItemId: item.id,
  description: item.documentDescription || item.product?.name || 'สินค้า',
  quantity: money(item.quantity),
  unitAmount: money(item.basePrice),
  discountAmount: money(item.discount),
  lineAmount: money(item.price),
  barcode: null,
});

const lineKey = (saleId, lineType, saleItemId) => `${saleId}:${lineType}:${saleItemId}`;

const listEligibleDeliveryCredits = async ({ prisma, command }) => {
  const group = await resolveFinancialCustomerGroup(prisma, { customerId: command.customerId, branchId: command.branchId });
  const customer = await prisma.customerProfile.findFirst({
    where: { id: command.customerId, branchId: command.branchId },
    select: { id: true, name: true, companyName: true, taxId: true },
  });
  if (!customer) {
    const error = new Error('ไม่พบลูกค้าในสาขานี้');
    error.code = 'CUSTOMER_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const keyword = command.search;
  const sales = await prisma.sale.findMany({
    where: {
      branchId: command.branchId,
      customerId: { in: group.memberIds },
      isCredit: true,
      status: { not: 'CANCELLED' },
      statusPayment: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      ...(keyword ? {
        OR: [
          { code: { contains: keyword, mode: 'insensitive' } },
          { officialDocumentNumber: { contains: keyword, mode: 'insensitive' } },
          { refCode: { contains: keyword, mode: 'insensitive' } },
        ],
      } : {}),
    },
    select: {
      id: true,
      customerId: true,
      customer: { select: { id: true, name: true, companyName: true, departmentName: true } },
      code: true,
      officialDocumentNumber: true,
      soldAt: true,
      dueDate: true,
      totalAmount: true,
      paidAmount: true,
      statusPayment: true,
      note: true,
      items: {
        select: {
          id: true,
          basePrice: true,
          discount: true,
          price: true,
          documentDescription: true,
          stockItem: { select: { barcode: true, product: { select: { name: true } } } },
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
    orderBy: [{ dueDate: 'asc' }, { soldAt: 'asc' }, { id: 'asc' }],
    take: command.take,
  });

  const saleIds = sales.map((sale) => sale.id);
  const priorLines = saleIds.length ? await prisma.customerMoneySettlementLine.findMany({
    where: {
      saleId: { in: saleIds },
      settlement: { status: 'ACTIVE', settlementType: 'DELIVERY_CREDIT' },
    },
    select: { saleId: true, saleItemType: true, saleItemId: true, appliedAmount: true },
  }) : [];
  const appliedByLine = priorLines.reduce((map, line) => {
    const key = lineKey(line.saleId, line.saleItemType, line.saleItemId);
    map.set(key, (map.get(key) || 0) + money(line.appliedAmount));
    return map;
  }, new Map());

  const [balance, availableAmount] = await Promise.all([
    prisma.customerMoneyBalance.findUnique({
      where: { branchId_customerId: { branchId: command.branchId, customerId: group.ownerId } },
      select: { id: true, availableAmount: true, updatedAt: true },
    }),
    calculateAvailableCustomerMoney(prisma, {
      branchId: command.branchId,
      customerId: command.customerId,
    }),
  ]);

  return {
    customer: { ...customer, financialOwner: group.owner, members: group.members },
    balance: {
      id: balance?.id || null,
      availableAmount: money(availableAmount),
      updatedAt: balance?.updatedAt || null,
      projectedAmount: money(balance?.availableAmount),
      projectionMatchesSource: balance ? money(balance.availableAmount) === money(availableAmount) : money(availableAmount) === 0,
    },
    sales: sales.map((sale) => {
      const lines = [...sale.items.map(mapStockLine), ...sale.simpleItems.map(mapSimpleLine)]
        .map((line) => {
          const appliedAmount = appliedByLine.get(lineKey(sale.id, line.lineType, line.saleItemId)) || 0;
          return {
            ...line,
            appliedAmount: Number(appliedAmount.toFixed(2)),
            remainingAmount: Math.max(0, Number((line.lineAmount - appliedAmount).toFixed(2))),
          };
        })
        .filter((line) => line.remainingAmount > 0);
      return {
        id: sale.id,
        customerId: sale.customerId,
        department: sale.customer,
        code: sale.code,
        documentNo: sale.officialDocumentNumber || sale.code,
        soldAt: sale.soldAt,
        dueDate: sale.dueDate,
        totalAmount: money(sale.totalAmount),
        paidAmount: money(sale.paidAmount),
        outstandingAmount: outstanding(sale),
        statusPayment: sale.statusPayment,
        note: sale.note || null,
        lines,
      };
    }).filter((sale) => sale.outstandingAmount > 0 && sale.lines.length > 0),
  };
};

module.exports = { listEligibleDeliveryCredits, outstanding, lineKey };
