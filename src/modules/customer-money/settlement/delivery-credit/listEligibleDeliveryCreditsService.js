'use strict';

const {
  buildSpendableSourceState,
} = require('../../balance/customerMoneySourcePoolService');
const { resolveFinancialCustomerGroup } = require('../../../customer/financial-group/customerFinancialGroupResolver');
const {
  buildActiveCreditReceivableWhere,
  calculateOutstandingReceivable,
  calculateReturnedReceivableAmount,
  calculateNetReceivableTotal,
} = require('../../../sales/shared/creditReceivableAuthority');

const money = (value) => Number(value || 0);
const outstanding = calculateOutstandingReceivable;

const mapStockLine = (item) => {
  const returnedQuantity = Math.min(1, Math.max(0, money(item.returnedQuantity)));
  const quantity = Math.max(0, 1 - returnedQuantity);
  return {
    lineType: 'STOCK',
    saleItemId: item.id,
    description: item.documentDescription || item.stockItem?.product?.name || 'สินค้า',
    quantity,
    originalQuantity: 1,
    returnedQuantity,
    unitAmount: money(item.basePrice),
    discountAmount: money(item.discount),
    originalLineAmount: money(item.price),
    lineAmount: Number((money(item.price) * quantity).toFixed(2)),
    barcode: item.stockItem?.barcode || null,
  };
};

const mapSimpleLine = (item) => {
  const originalQuantity = Math.max(0, money(item.quantity));
  const returnedQuantity = Math.min(originalQuantity, Math.max(0, money(item.returnedQuantity)));
  const quantity = Math.max(0, originalQuantity - returnedQuantity);
  const lineAmount = originalQuantity > 0
    ? Number((money(item.price) * (quantity / originalQuantity)).toFixed(2))
    : 0;
  return {
    lineType: 'SIMPLE',
    saleItemId: item.id,
    description: item.documentDescription || item.product?.name || 'สินค้า',
    quantity,
    originalQuantity,
    returnedQuantity,
    unitAmount: money(item.basePrice),
    discountAmount: money(item.discount),
    originalLineAmount: money(item.price),
    lineAmount,
    barcode: null,
  };
};

const lineKey = (saleId, lineType, saleItemId) => `${saleId}:${lineType}:${saleItemId}`;

const listEligibleDeliveryCredits = async ({ prisma, command }) => {
  const group = await resolveFinancialCustomerGroup(prisma, { customerId: command.customerId, branchId: command.branchId });
  const customer = await prisma.customerProfile.findFirst({
    where: { id: command.customerId, branchId: command.branchId },
    select: { id: true, name: true, companyName: true, departmentName: true, taxId: true },
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
      ...buildActiveCreditReceivableWhere({ branchId: command.branchId, customerIds: group.memberIds }),
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
          returnedQuantity: true,
          documentDescription: true,
          stockItem: { select: { barcode: true, product: { select: { name: true } } } },
        },
      },
      simpleItems: {
        select: {
          id: true,
          quantity: true,
          returnedQuantity: true,
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

  const [balance, sourceState] = await Promise.all([
    prisma.customerMoneyBalance.findUnique({
      where: { branchId_customerId: { branchId: command.branchId, customerId: group.ownerId } },
      select: { id: true, availableAmount: true, updatedAt: true },
    }),
    buildSpendableSourceState(prisma, {
      branchId: command.branchId,
      customerId: command.customerId,
      financialGroup: group,
    }),
  ]);

  const availableAmount = sourceState.availableAmount;
  const sourceStates = sourceState.sourceStates || [];
  const sourceCustomerIds = [...new Set(sourceStates
    .map((source) => Number(source?.snapshot?.customerId))
    .filter((id) => Number.isInteger(id) && id > 0))];

  return {
    customer: { ...customer, financialOwner: group.owner, members: group.members },
    balance: {
      id: balance?.id || null,
      availableAmount: money(availableAmount),
      updatedAt: balance?.updatedAt || null,
      projectedAmount: money(balance?.availableAmount),
      projectionMatchesSource: balance ? money(balance.availableAmount) === money(availableAmount) : money(availableAmount) === 0,
      sourceCount: sourceStates.length,
      spendableSourceCount: (sourceState.sources || []).length,
      sourceTotal: money(sourceState.sourceTotal),
      legacyReservedAmount: money(sourceState.legacyReservedAmount),
      uncoveredLegacyReservation: money(sourceState.uncoveredLegacyReservation),
      financialOwnerId: group.ownerId,
      financialMemberIds: group.memberIds,
      sourceCustomerIds,
    },
    sales: sales.map((sale) => {
      const returnedAmount = calculateReturnedReceivableAmount(sale);
      const billableAmount = calculateNetReceivableTotal(sale);
      const lines = [...sale.items.map(mapStockLine), ...sale.simpleItems.map(mapSimpleLine)]
        .map((line) => {
          const appliedAmount = appliedByLine.get(lineKey(sale.id, line.lineType, line.saleItemId)) || 0;
          return {
            ...line,
            appliedAmount: Number(appliedAmount.toFixed(2)),
            remainingAmount: Math.max(0, Number((line.lineAmount - appliedAmount).toFixed(2))),
          };
        })
        .filter((line) => line.quantity > 0 && line.remainingAmount > 0);
      return {
        id: sale.id,
        customerId: sale.customerId,
        department: sale.customer,
        code: sale.code,
        documentNo: sale.officialDocumentNumber || sale.code,
        soldAt: sale.soldAt,
        dueDate: sale.dueDate,
        totalAmount: money(sale.totalAmount),
        returnedAmount,
        billableAmount,
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
