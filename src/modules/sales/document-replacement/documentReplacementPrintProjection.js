'use strict';

const amount = (value) => Number(Number(value || 0).toFixed(2));

const mapReplacementLine = (line, index) => Object.freeze({
  id: `replacement-${Number(line?.id || 0) || index}`,
  replacementLine: true,
  replacementPortion: String(line?.portion || 'IN_BUDGET').toUpperCase(),
  description: String(line?.description || '').trim() || 'Document item',
  quantity: Number(line?.quantity || 0),
  unitName: String(line?.unitName || '').trim() || null,
  unitAmount: amount(line?.unitPrice),
  discountAmount: 0,
  lineAmount: amount(line?.amount),
  lineType: String(line?.lineType || '').trim().toUpperCase() || null,
  barcode: null,
});

const buildCurrentReplacementPrintProjection = ({ replacement } = {}) => {
  if (!replacement || replacement.status !== 'LOCKED' || !replacement.finalSnapshot) return null;

  const snapshot = replacement.finalSnapshot;
  const lines = (Array.isArray(snapshot.lines) ? snapshot.lines : [])
    .filter((line) => String(line?.portion || '').toUpperCase() === 'IN_BUDGET')
    .sort((left, right) => Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0))
    .map(mapReplacementLine);

  return Object.freeze({
    replacementId: Number(replacement.id),
    replacementNumber: Number(replacement.replacementNumber || snapshot.replacementNumber || 0),
    replacesReplacementId: replacement.replacesReplacementId == null
      ? null
      : Number(replacement.replacesReplacementId),
    reason: replacement.reason || snapshot.reason || null,
    lockedAt: replacement.lockedAt || snapshot.lockedAt || null,
    lines: Object.freeze(lines),
    totals: Object.freeze({
      sourceTotal: amount(snapshot?.totals?.sourceTotal),
      inBudgetTotal: amount(snapshot?.totals?.inBudgetTotal),
      outOfBudgetTotal: amount(snapshot?.totals?.outOfBudgetTotal),
    }),
  });
};

const loadCurrentReplacementPrintProjection = async ({ prisma, branchId, preparationId }) => {
  if (!prisma || !Number.isInteger(Number(branchId)) || !Number.isInteger(Number(preparationId))) return null;

  const currentKey = `${Number(branchId)}:${Number(preparationId)}:CURRENT`;
  const replacement = await prisma.saleDocumentReplacement.findUnique({
    where: { currentKey },
  });
  return buildCurrentReplacementPrintProjection({ replacement });
};

module.exports = Object.freeze({
  buildCurrentReplacementPrintProjection,
  loadCurrentReplacementPrintProjection,
  mapReplacementLine,
});
