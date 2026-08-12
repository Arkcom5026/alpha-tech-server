'use strict';

const { Prisma } = require('../../../../../lib/prisma');
const { generateCombinedBillingCode } = require('./createCombinedBillingDocumentRepository');

const D = (value) => (value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value ?? 0)));
const number = (value) => Number(value || 0);
const keyOf = (lineType, lineId) => `${String(lineType || '').toUpperCase()}:${Number(lineId)}`;

const loadSettlementGeneratedDocument = async (tx, { branchId, settlementId }) => {
  if (!tx?.customerMoneySettlementGeneratedDocument) return null;
  const link = await tx.customerMoneySettlementGeneratedDocument.findUnique({
    where: { settlementId: Number(settlementId) },
  });
  if (!link || Number(link.branchId) !== Number(branchId)) return null;
  const document = await tx.combinedBillingDocument.findFirst({
    where: { id: link.combinedBillingId, branchId: Number(branchId) },
    include: {
      customer: { select: { id: true, name: true, companyName: true, departmentName: true, taxId: true } },
      documentLines: { orderBy: { id: 'asc' } },
    },
  });
  return document ? { ...document, generationStatus: link.status } : null;
};

const createSettlementConsolidatedDelivery = async ({
  tx,
  branchId,
  employeeId,
  settlementId,
  customerId,
  prepared,
  note,
}) => {
  if (!tx?.customerMoneySettlementGeneratedDocument) {
    const error = new Error('Prisma Client ยังไม่มี Settlement Generated Document authority กรุณารัน prisma generate หลังใช้ migration ของวาระนี้');
    error.code = 'SETTLEMENT_DOCUMENT_AUTHORITY_NOT_READY';
    error.statusCode = 503;
    throw error;
  }

  const existing = await loadSettlementGeneratedDocument(tx, { branchId, settlementId });
  if (existing) return existing;

  const paidReady = (prepared || []).filter((item) => item.completesLine === true);
  if (!paidReady.length) return null;

  const sourceKeys = paidReady.map((item) => ({
    sourceLineType: item.requested.lineType,
    sourceLineId: item.requested.saleItemId,
  }));
  const documented = await tx.consolidatedDeliveryLine.findMany({
    where: {
      branchId: Number(branchId),
      status: 'DOCUMENTED',
      OR: sourceKeys,
    },
    select: { sourceLineType: true, sourceLineId: true },
  });
  const documentedKeys = new Set(documented.map((row) => keyOf(row.sourceLineType, row.sourceLineId)));
  const ready = paidReady.filter((item) => !documentedKeys.has(keyOf(item.requested.lineType, item.requested.saleItemId)));
  if (!ready.length) return null;

  const totalAmount = ready.reduce((sum, item) => sum.plus(D(item.snapshot.lineAmount)), D(0));
  const code = await generateCombinedBillingCode(tx, Number(branchId), new Date());
  const document = await tx.combinedBillingDocument.create({
    data: {
      code,
      note: String(note || '').trim() || `สร้างอัตโนมัติจากเอกสารตัดยอด #${settlementId}`,
      createdBy: Number(employeeId),
      customerId: Number(customerId),
      branchId: Number(branchId),
      totalBeforeVat: totalAmount,
      vatAmount: D(0),
      totalAmount,
      status: 'ISSUED',
      documentLines: {
        create: ready.map((item) => {
          const quantity = D(item.snapshot.quantity);
          const lineAmount = D(item.snapshot.lineAmount);
          const unitPrice = quantity.greaterThan(0) ? lineAmount.dividedBy(quantity).toDecimalPlaces(2) : lineAmount;
          return {
            branchId: Number(branchId),
            customerId: Number(customerId),
            sourceSaleId: Number(item.sale.id),
            sourceSaleCode: item.sale.code,
            sourceDocumentNo: item.sale.officialDocumentNumber || item.sale.code,
            sourceLineType: item.requested.lineType,
            sourceLineId: Number(item.requested.saleItemId),
            description: item.snapshot.description,
            quantity,
            sourceUnitPrice: unitPrice,
            documentUnitPrice: unitPrice,
            priceAdjustment: D(0),
            adjustmentReason: null,
            settledAmount: lineAmount,
            documentAmount: lineAmount,
            sourceSnapshot: {
              sourceSaleId: Number(item.sale.id),
              sourceSaleCode: item.sale.code,
              sourceDocumentNo: item.sale.officialDocumentNumber || item.sale.code,
              sourceCustomerId: Number(item.sale.customerId),
              sourceCustomer: item.sale.customer || null,
              sourceLineType: item.requested.lineType,
              sourceLineId: Number(item.requested.saleItemId),
              sourceLineAmount: number(item.snapshot.lineAmount),
              completedBySettlementId: Number(settlementId),
              settlementAppliedAmount: number(item.requested.amount),
              previouslySettledAmount: number(item.alreadyAppliedAmount),
            },
          };
        }),
      },
    },
    include: {
      customer: { select: { id: true, name: true, companyName: true, departmentName: true, taxId: true } },
      documentLines: { orderBy: { id: 'asc' } },
    },
  });

  await tx.customerMoneySettlementGeneratedDocument.create({
    data: {
      branchId: Number(branchId),
      settlementId: Number(settlementId),
      combinedBillingId: document.id,
      status: 'ACTIVE',
    },
  });

  return { ...document, generationStatus: 'ACTIVE' };
};

module.exports = {
  createSettlementConsolidatedDelivery,
  loadSettlementGeneratedDocument,
  keyOf,
};
