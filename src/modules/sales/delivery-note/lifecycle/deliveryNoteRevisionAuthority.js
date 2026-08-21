'use strict';

const money = (value) => Number(Number(value || 0).toFixed(2));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value || 0)));

const fail = (code, message, statusCode = 409) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const describe = (item) => item?.documentDescription
  || item?.product?.name
  || item?.stockItem?.product?.name
  || 'สินค้า';

const projectOriginalRevisionLine = ({ type, item, sortOrder }) => {
  const sourceLineType = String(type || '').toUpperCase();
  const originalQuantity = sourceLineType === 'STOCK' ? 1 : Math.max(0, Number(item?.quantity || 0));
  const originalAmount = money(item?.price);
  return Object.freeze({
    sourceLineType,
    sourceLineId: Number(item?.id),
    description: describe(item),
    originalQuantity: money(originalQuantity),
    returnedQuantity: 0,
    activeQuantity: money(originalQuantity),
    unitAmount: originalQuantity > 0 ? money(originalAmount / originalQuantity) : originalAmount,
    originalAmount,
    returnedAmount: 0,
    activeAmount: originalAmount,
    sortOrder,
    snapshot: {
      documentDescription: item?.documentDescription || null,
      sourceProductId: Number(item?.productId || item?.stockItem?.productId || 0) || null,
    },
  });
};

const projectAdjustedRevisionLine = ({ type, item, sortOrder }) => {
  const sourceLineType = String(type || '').toUpperCase();
  const originalQuantity = sourceLineType === 'STOCK' ? 1 : Math.max(0, Number(item?.quantity || 0));
  const returnedQuantity = clamp(item?.returnedQuantity, 0, originalQuantity);
  const activeQuantity = money(Math.max(0, originalQuantity - returnedQuantity));
  const originalAmount = money(item?.price);
  const returnedAmount = originalQuantity > 0
    ? money(originalAmount * (returnedQuantity / originalQuantity))
    : 0;
  const activeAmount = money(Math.max(0, originalAmount - returnedAmount));
  if (activeQuantity <= 0 || activeAmount <= 0) return null;
  return Object.freeze({
    sourceLineType,
    sourceLineId: Number(item?.id),
    description: describe(item),
    originalQuantity: money(originalQuantity),
    returnedQuantity: money(returnedQuantity),
    activeQuantity,
    unitAmount: originalQuantity > 0 ? money(originalAmount / originalQuantity) : originalAmount,
    originalAmount,
    returnedAmount,
    activeAmount,
    sortOrder,
    snapshot: {
      documentDescription: item?.documentDescription || null,
      sourceProductId: Number(item?.productId || item?.stockItem?.productId || 0) || null,
    },
  });
};

const projectSaleRevisionState = (sale) => {
  if (!sale) fail('DELIVERY_NOTE_REVISION_SOURCE_REQUIRED', 'Sale source is required', 400);
  const originalLines = [];
  const adjustedLines = [];
  let sortOrder = 0;
  for (const item of sale.items || []) {
    originalLines.push(projectOriginalRevisionLine({ type: 'STOCK', item, sortOrder }));
    const adjusted = projectAdjustedRevisionLine({ type: 'STOCK', item, sortOrder });
    if (adjusted) adjustedLines.push(adjusted);
    sortOrder += 1;
  }
  for (const item of sale.simpleItems || []) {
    originalLines.push(projectOriginalRevisionLine({ type: 'SIMPLE', item, sortOrder }));
    const adjusted = projectAdjustedRevisionLine({ type: 'SIMPLE', item, sortOrder });
    if (adjusted) adjustedLines.push(adjusted);
    sortOrder += 1;
  }
  const grossAmount = money(originalLines.reduce((sum, line) => sum + line.originalAmount, 0));
  const activeAmount = money(adjustedLines.reduce((sum, line) => sum + line.activeAmount, 0));
  const returnedAmount = money(Math.max(0, grossAmount - activeAmount));
  return Object.freeze({ grossAmount, returnedAmount, activeAmount, originalLines, adjustedLines });
};

const currentKeyOf = ({ branchId, saleId }) => `${Number(branchId)}:${Number(saleId)}`;

const buildOriginalMaterialization = ({ sale, createdById, issuedAt = null }) => {
  if (!sale?.officialDocumentNumber) {
    fail('DELIVERY_NOTE_ORIGINAL_NUMBER_REQUIRED', 'Legacy Delivery Note number is required before materialization');
  }
  const state = projectSaleRevisionState(sale);
  return Object.freeze({
    branchId: Number(sale.branchId),
    saleId: Number(sale.id),
    documentNumber: String(sale.officialDocumentNumber),
    revisionNumber: 1,
    revisionKind: 'ORIGINAL',
    state: 'CURRENT',
    replacesDocumentId: null,
    currentKey: currentKeyOf(sale),
    grossAmount: state.grossAmount,
    returnedAmount: 0,
    activeAmount: state.grossAmount,
    issuedAt: issuedAt || sale.soldAt || sale.createdAt || new Date(),
    createdById: Number(createdById),
    snapshot: {
      sourceSaleCode: sale.code,
      legacyMaterialization: true,
      historicalGrossAmount: state.grossAmount,
    },
    lines: state.originalLines,
  });
};

const buildReturnAdjustedRevision = ({ sale, predecessor, documentNumber, createdById, returnSources = [] }) => {
  if (!predecessor?.id || predecessor.state !== 'CURRENT') {
    fail('DELIVERY_NOTE_CURRENT_REVISION_REQUIRED', 'A current Delivery Note revision is required');
  }
  if (!documentNumber || !String(documentNumber).trim()) {
    fail('DELIVERY_NOTE_REVISION_NUMBER_REQUIRED', 'A new immutable Delivery Note number is required', 400);
  }
  if (String(documentNumber) === String(predecessor.documentNumber)) {
    fail('DELIVERY_NOTE_REVISION_NUMBER_REUSE', 'A revision must use a new document number');
  }
  const state = projectSaleRevisionState(sale);
  if (state.returnedAmount <= 0) {
    fail('DELIVERY_NOTE_REVISION_RETURN_REQUIRED', 'Return-adjusted revision requires return evidence');
  }
  if (state.activeAmount <= 0 || state.adjustedLines.length === 0) {
    fail('DELIVERY_NOTE_REVISION_EMPTY', 'A zero-line Delivery Note revision cannot be issued');
  }
  if (money(predecessor.activeAmount) === state.activeAmount) {
    fail('DELIVERY_NOTE_REVISION_NO_CHANGE', 'Current active delivery state has not changed');
  }
  const completedReturnSources = (returnSources || []).filter((row) => String(row?.status || '').toUpperCase() === 'COMPLETED');
  if (!completedReturnSources.length) {
    fail('DELIVERY_NOTE_REVISION_COMPLETED_RETURN_REQUIRED', 'At least one completed Sale Return must support the revision');
  }
  return Object.freeze({
    predecessorUpdate: Object.freeze({
      state: 'SUPERSEDED',
      currentKey: null,
      supersededAt: new Date(),
    }),
    revision: Object.freeze({
      branchId: Number(sale.branchId),
      saleId: Number(sale.id),
      documentNumber: String(documentNumber).trim(),
      revisionNumber: Number(predecessor.revisionNumber) + 1,
      revisionKind: 'RETURN_ADJUSTMENT',
      state: 'CURRENT',
      replacesDocumentId: Number(predecessor.id),
      currentKey: currentKeyOf(sale),
      grossAmount: state.grossAmount,
      returnedAmount: state.returnedAmount,
      activeAmount: state.activeAmount,
      issuedAt: new Date(),
      createdById: Number(createdById),
      snapshot: {
        sourceSaleCode: sale.code,
        predecessorDocumentNumber: predecessor.documentNumber,
        historicalGrossAmount: state.grossAmount,
        cumulativeReturnedAmount: state.returnedAmount,
        activeAmount: state.activeAmount,
      },
      lines: state.adjustedLines,
      returnSources: completedReturnSources.map((source) => ({
        saleReturnId: Number(source.id),
        returnedAt: source.returnedAt || source.completedAt || new Date(),
        snapshot: { code: source.code || null, returnedAt: source.returnedAt || null },
      })),
    }),
  });
};

module.exports = Object.freeze({
  projectSaleRevisionState,
  buildOriginalMaterialization,
  buildReturnAdjustedRevision,
  currentKeyOf,
});
