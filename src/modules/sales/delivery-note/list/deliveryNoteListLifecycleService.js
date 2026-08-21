'use strict';

const { prisma } = require('../../../../../lib/prisma');

const EPSILON = 0.0001;
const MAX_SALE_IDS = 500;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toTimestamp = (value) => {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizeSaleIds = (saleIds) => {
  const source = Array.isArray(saleIds) ? saleIds : [];
  const ids = [...new Set(source.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
  if (ids.length > MAX_SALE_IDS) {
    const error = new Error(`saleIds exceeds ${MAX_SALE_IDS} items`);
    error.code = 'DELIVERY_NOTE_LIST_TOO_MANY_SALES';
    error.statusCode = 400;
    throw error;
  }
  return ids;
};

const summarizeLegacyReturnLines = (sale = {}) => {
  const stockLines = Array.isArray(sale.items) ? sale.items : [];
  const simpleLines = Array.isArray(sale.simpleItems) ? sale.simpleItems : [];
  const lineCount = stockLines.length + simpleLines.length;

  let returnedLineCount = 0;
  let fullyReturnedLineCount = 0;
  let returnedQuantity = 0;
  let latestReturnAt = null;

  const rememberReturnAt = (value) => {
    if (!value) return;
    if (!latestReturnAt || toTimestamp(value) > toTimestamp(latestReturnAt)) latestReturnAt = value;
  };

  for (const item of stockLines) {
    const returned = Math.max(0, Math.min(1, toNumber(item?.returnedQuantity)));
    if (returned > EPSILON) {
      returnedLineCount += 1;
      rememberReturnAt(item?.lastReturnedAt);
    }
    if (returned >= 1 - EPSILON) fullyReturnedLineCount += 1;
    returnedQuantity += returned;
  }

  for (const item of simpleLines) {
    const original = Math.max(0, toNumber(item?.quantity));
    const returned = Math.max(0, Math.min(original, toNumber(item?.returnedQuantity)));
    if (returned > EPSILON) {
      returnedLineCount += 1;
      rememberReturnAt(item?.lastReturnedAt);
    }
    if (original > EPSILON && returned >= original - EPSILON) fullyReturnedLineCount += 1;
    returnedQuantity += returned;
  }

  return Object.freeze({
    lineCount,
    returnedLineCount,
    returnedQuantity: Number(returnedQuantity.toFixed(2)),
    latestReturnAt,
    hasReturnActivity: returnedLineCount > 0,
    fullyReturned: lineCount > 0 && fullyReturnedLineCount === lineCount,
  });
};

const projectLifecycleSummary = ({ sale, currentDocument } = {}) => {
  const legacy = summarizeLegacyReturnLines(sale);
  const persistedReturnedAmount = Math.max(0, toNumber(currentDocument?.returnedAmount));
  const revisionNumber = Number(currentDocument?.revisionNumber || 0) || null;
  const isAdjustedRevision = String(currentDocument?.revisionKind || '').toUpperCase() === 'RETURN_ADJUSTMENT'
    || (revisionNumber != null && revisionNumber > 1);
  const hasReturnActivity = legacy.hasReturnActivity || persistedReturnedAmount > EPSILON || isAdjustedRevision;
  const latestReturnTimestamp = toTimestamp(legacy.latestReturnAt);
  const currentIssuedTimestamp = toTimestamp(currentDocument?.issuedAt);
  const hasReturnAfterCurrentRevision = hasReturnActivity && (
    !currentDocument
    || (latestReturnTimestamp > 0 && latestReturnTimestamp > currentIssuedTimestamp)
  );

  let lifecycleStatus = 'NORMAL';
  if (hasReturnActivity && legacy.fullyReturned && hasReturnAfterCurrentRevision) {
    lifecycleStatus = 'FULLY_RETURNED';
  } else if (hasReturnAfterCurrentRevision) {
    lifecycleStatus = 'RETURNED_PENDING_REVISION';
  } else if (hasReturnActivity && isAdjustedRevision) {
    lifecycleStatus = 'RETURN_ADJUSTED_CURRENT';
  } else if (hasReturnActivity) {
    lifecycleStatus = 'RETURNED_PENDING_REVISION';
  }

  return Object.freeze({
    saleId: Number(sale?.id),
    lifecycleStatus,
    hasReturnActivity,
    hasReturnAfterCurrentRevision,
    fullyReturned: legacy.fullyReturned,
    returnedLineCount: legacy.returnedLineCount,
    returnedQuantity: legacy.returnedQuantity,
    latestReturnAt: legacy.latestReturnAt || null,
    currentRevision: currentDocument
      ? Object.freeze({
          id: Number(currentDocument.id),
          documentNumber: currentDocument.documentNumber || null,
          revisionNumber,
          revisionKind: currentDocument.revisionKind || null,
          state: currentDocument.state || null,
          issuedAt: currentDocument.issuedAt || null,
          activeAmount: Number(toNumber(currentDocument.activeAmount).toFixed(2)),
          returnedAmount: Number(persistedReturnedAmount.toFixed(2)),
        })
      : null,
  });
};

const loadDeliveryNoteListLifecycleSummaries = async ({ branchId, saleIds, db = prisma } = {}) => {
  const normalizedBranchId = Number(branchId);
  if (!Number.isInteger(normalizedBranchId) || normalizedBranchId <= 0) {
    const error = new Error('branchId is required');
    error.code = 'DELIVERY_NOTE_LIST_BRANCH_REQUIRED';
    error.statusCode = 401;
    throw error;
  }

  const ids = normalizeSaleIds(saleIds);
  if (ids.length === 0) return [];

  const [sales, currentDocuments] = await Promise.all([
    db.sale.findMany({
      where: { branchId: normalizedBranchId, id: { in: ids } },
      select: {
        id: true,
        items: { select: { returnedQuantity: true, lastReturnedAt: true } },
        simpleItems: { select: { quantity: true, returnedQuantity: true, lastReturnedAt: true } },
      },
    }),
    db.deliveryNoteDocument.findMany({
      where: {
        branchId: normalizedBranchId,
        saleId: { in: ids },
        state: 'CURRENT',
      },
      select: {
        id: true,
        saleId: true,
        documentNumber: true,
        revisionNumber: true,
        revisionKind: true,
        state: true,
        issuedAt: true,
        activeAmount: true,
        returnedAmount: true,
      },
      orderBy: [{ saleId: 'asc' }, { revisionNumber: 'desc' }],
    }),
  ]);

  const currentBySaleId = new Map();
  for (const document of currentDocuments) {
    if (!currentBySaleId.has(Number(document.saleId))) {
      currentBySaleId.set(Number(document.saleId), document);
    }
  }

  return sales.map((sale) => projectLifecycleSummary({
    sale,
    currentDocument: currentBySaleId.get(Number(sale.id)) || null,
  }));
};

module.exports = Object.freeze({
  MAX_SALE_IDS,
  normalizeSaleIds,
  summarizeLegacyReturnLines,
  projectLifecycleSummary,
  loadDeliveryNoteListLifecycleSummaries,
});
