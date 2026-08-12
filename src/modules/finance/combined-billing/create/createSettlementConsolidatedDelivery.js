'use strict';

const { Prisma } = require('../../../../../lib/prisma');
const { generateCombinedBillingCode } = require('./createCombinedBillingDocumentRepository');

const D = (value) => (value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value ?? 0)));
const number = (value) => Number(value || 0);
const keyOf = (lineType, lineId) => `${String(lineType || '').toUpperCase()}:${Number(lineId)}`;

const findSettlementGeneratedDocumentAnchor = async (tx, { branchId, settlementId }) => {
  if (!tx?.consolidatedDeliveryLine?.findFirst) return null;
  return tx.consolidatedDeliveryLine.findFirst({
    where: {
      branchId: Number(branchId),
      sourceSnapshot: {
        path: ['completedBySettlementId'],
        equals: Number(settlementId),
      },
    },
    select: { combinedBillingId: true, status: true },
    orderBy: { id: 'asc' },
  });
};

const loadSettlementGeneratedDocument = async (tx, { branchId, settlementId }) => {
  const anchor = await findSettlementGeneratedDocumentAnchor(tx, { branchId, settlementId });
  if (!anchor) return null;
  const document = await tx.combinedBillingDocument.findFirst({
    where: { id: anchor.combinedBillingId, branchId: Number(branchId) },
    include: {
      customer: { select: { id: true, name: true, companyName: true, departmentName: true, taxId: true } },
      documentLines: { orderBy: { id: 'asc' } },
    },
  });
  if (!document) return null;
  return {
    ...document,
    generationStatus: anchor.status === 'CANCELLED' || document.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
  };
};

const acquireGeneratedDeliveryCodeLock = async (tx, branchId) => {
  if (!tx?.$queryRaw) return;
  await tx.$queryRaw`SELECT 1::int AS "locked" FROM (SELECT pg_advisory_xact_lock(${-1006}::int, ${Number(branchId)}::int)) AS advisory_lock`;
};

const isAutoConsolidationBatch = (prepared = []) => {
  if (!prepared.length || prepared.some((item) => item.completesLine !== true)) return false;
  const sourceSaleIds = new Set(prepared.map((item) => Number(item?.sale?.id)).filter((id) => Number.isInteger(id) && id > 0));
  return sourceSaleIds.size >= 2;
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
  const existing = await loadSettlementGeneratedDocument(tx, { branchId, settlementId });
  if (existing) return existing;

  // Auto completion owns only a complete multi-delivery batch. A single source
  // delivery or a batch that still contains partial lines keeps the original/manual
  // document path, avoiding duplicate or prematurely-finalized delivery documents.
  if (!isAutoConsolidationBatch(prepared)) return null;

  const sourceKeys = prepared.map((item) => ({
    sourceLineType: item.requested.lineType,
    sourceLineId: item.requested.saleItemId,
  }));
  const priorDocumentLines = await tx.consolidatedDeliveryLine.findMany({
    where: {
      branchId: Number(branchId),
      OR: sourceKeys,
    },
    select: { sourceLineType: true, sourceLineId: true, status: true, combinedBillingId: true },
  });
  const activeDocumentLine = priorDocumentLines.find((row) => row.status === 'DOCUMENTED');
  if (activeDocumentLine) {
    const error = new Error('มีรายการในชุดตัดยอดนี้ถูกนำไปสร้างใบส่งของรวมแล้ว กรุณาตรวจสอบเอกสารเดิม');
    error.code = 'SETTLEMENT_SOURCE_ALREADY_DOCUMENTED';
    error.statusCode = 409;
    throw error;
  }
  // ConsolidatedDeliveryLine keeps one immutable source-line identity for audit.
  // If a previous generated document was cancelled, financial settlement may proceed
  // again, but automatic re-issuance is skipped instead of overwriting history.
  if (priorDocumentLines.length > 0) return null;

  const totalAmount = prepared.reduce((sum, item) => sum.plus(D(item.snapshot.lineAmount)), D(0));
  await acquireGeneratedDeliveryCodeLock(tx, branchId);
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
        create: prepared.map((item) => {
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

  return { ...document, generationStatus: 'ACTIVE' };
};

module.exports = {
  createSettlementConsolidatedDelivery,
  loadSettlementGeneratedDocument,
  findSettlementGeneratedDocumentAnchor,
  acquireGeneratedDeliveryCodeLock,
  isAutoConsolidationBatch,
  keyOf,
};
