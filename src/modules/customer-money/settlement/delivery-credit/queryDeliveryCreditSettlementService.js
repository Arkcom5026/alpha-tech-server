'use strict';

const { getSettlement, listSettlements } = require('./deliveryCreditSettlementRepository');

const toNumber = (value) => Number(value || 0);

const serializeApplication = (application) => application ? ({
  ...application,
  amount: toNumber(application.amount),
}) : null;

const serializeLines = (lines = []) => {
  const grouped = new Map();
  for (const line of lines) {
    const key = `${line.saleId}:${line.saleItemType}:${line.saleItemId}`;
    const application = serializeApplication(line.application);
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...line,
        quantity: toNumber(line.quantity),
        unitAmount: toNumber(line.unitAmount),
        lineAmount: toNumber(line.lineAmount),
        appliedAmount: 0,
        application,
        applications: [],
      });
    }
    const target = grouped.get(key);
    target.appliedAmount = Number((target.appliedAmount + toNumber(line.appliedAmount)).toFixed(2));
    if (application) target.applications.push(application);
  }
  return [...grouped.values()];
};

const serialize = (record) => record ? ({
  ...record,
  totalAmount: toNumber(record.totalAmount),
  lines: serializeLines(record.lines || []),
}) : null;

const getGeneratedDocumentSummary = async ({ prisma, branchId, settlementId }) => {
  if (!prisma?.customerMoneySettlementGeneratedDocument) return null;
  const link = await prisma.customerMoneySettlementGeneratedDocument.findUnique({
    where: { settlementId: Number(settlementId) },
  });
  if (!link || Number(link.branchId) !== Number(branchId)) return null;
  const document = await prisma.combinedBillingDocument.findFirst({
    where: { id: link.combinedBillingId, branchId: Number(branchId) },
    select: {
      id: true,
      code: true,
      issueDate: true,
      status: true,
      totalAmount: true,
      _count: { select: { documentLines: true } },
    },
  });
  if (!document) return null;
  return {
    id: document.id,
    code: document.code,
    issueDate: document.issueDate,
    status: document.status,
    totalAmount: toNumber(document.totalAmount),
    lineCount: document._count.documentLines,
    generationStatus: link.status,
  };
};

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
  const [sales, generatedDocument] = await Promise.all([
    saleIds.length ? prisma.sale.findMany({
      where: { id: { in: saleIds }, branchId },
      select: {
        id: true,
        code: true,
        officialDocumentNumber: true,
        totalAmount: true,
        paidAmount: true,
        statusPayment: true,
        paid: true,
        paidAt: true,
        isCredit: true,
        status: true,
      },
    }) : [],
    getGeneratedDocumentSummary({ prisma, branchId, settlementId }),
  ]);

  result.salePaymentStates = sales.map((sale) => ({
    saleId: sale.id,
    saleCode: sale.code,
    documentNo: sale.officialDocumentNumber || sale.code,
    totalAmount: toNumber(sale.totalAmount),
    paidAmount: toNumber(sale.paidAmount),
    outstandingAmount: Math.max(0, Number((toNumber(sale.totalAmount) - toNumber(sale.paidAmount)).toFixed(2))),
    statusPayment: sale.statusPayment,
    paid: sale.paid,
    paidAt: sale.paidAt,
    taxDocumentReady: sale.isCredit === true && sale.status !== 'CANCELLED' && sale.statusPayment === 'PAID',
  }));
  result.generatedDocument = generatedDocument;

  return result;
};

module.exports = {
  serialize,
  serializeLines,
  getGeneratedDocumentSummary,
  listDeliveryCreditSettlements,
  getDeliveryCreditSettlement,
};
