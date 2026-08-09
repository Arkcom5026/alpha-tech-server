'use strict';

const { getSettlement, listSettlements } = require('./deliveryCreditSettlementRepository');

const toNumber = (value) => Number(value || 0);
const serialize = (record) => record ? ({
  ...record,
  totalAmount: toNumber(record.totalAmount),
  lines: (record.lines || []).map((line) => ({
    ...line,
    quantity: toNumber(line.quantity),
    unitAmount: toNumber(line.unitAmount),
    lineAmount: toNumber(line.lineAmount),
    appliedAmount: toNumber(line.appliedAmount),
    application: line.application ? { ...line.application, amount: toNumber(line.application.amount) } : null,
  })),
}) : null;

const listDeliveryCreditSettlements = async ({ prisma, user, query = {} }) => {
  const branchId = Number(user?.branchId);
  const customerId = Number(query.customerId);
  const take = Math.min(Math.max(Number(query.take) || 100, 1), 200);
  const rows = await listSettlements({
    client: prisma,
    branchId,
    customerId: Number.isInteger(customerId) && customerId > 0 ? customerId : null,
    take,
  });
  return rows.map(serialize);
};

const getDeliveryCreditSettlement = async ({ prisma, user, id }) => {
  const branchId = Number(user?.branchId);
  const settlementId = Number(id);
  const row = await getSettlement({ client: prisma, id: settlementId, branchId });
  if (!row) {
    const error = new Error('ไม่พบเอกสารตัดยอดใบส่งของ');
    error.code = 'SETTLEMENT_NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const result = serialize(row);
  const saleIds = [...new Set((result.lines || []).map((line) => Number(line.saleId)).filter(Number.isInteger))];
  const sales = saleIds.length ? await prisma.sale.findMany({
    where: { id: { in: saleIds }, branchId },
    select: {
      id: true,
      code: true,
      officialDocumentNumber: true,
      totalAmount: true,
      paidAmount: true,
      statusPayment: true,
      isCredit: true,
      status: true,
    },
  }) : [];

  result.salePaymentStates = sales.map((sale) => ({
    saleId: sale.id,
    saleCode: sale.code,
    documentNo: sale.officialDocumentNumber || sale.code,
    totalAmount: toNumber(sale.totalAmount),
    paidAmount: toNumber(sale.paidAmount),
    outstandingAmount: Math.max(0, Number((toNumber(sale.totalAmount) - toNumber(sale.paidAmount)).toFixed(2))),
    statusPayment: sale.statusPayment,
    taxDocumentReady: sale.isCredit === true && sale.status !== 'CANCELLED' && sale.statusPayment === 'PAID',
  }));

  return result;
};

module.exports = { serialize, listDeliveryCreditSettlements, getDeliveryCreditSettlement };
