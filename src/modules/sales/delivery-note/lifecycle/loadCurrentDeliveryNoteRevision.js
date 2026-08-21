'use strict';

const { currentKeyOf } = require('./deliveryNoteRevisionAuthority');

const money = (value) => Number(Number(value || 0).toFixed(2));

const mapPersistedRevisionLineToPrint = (line) => Object.freeze({
  id: Number(line.id),
  sourceLineType: line.sourceLineType,
  sourceLineId: Number(line.sourceLineId),
  description: line.description,
  quantity: money(line.activeQuantity),
  unitAmount: money(line.unitAmount),
  discountAmount: 0,
  lineAmount: money(line.activeAmount),
  originalQuantity: money(line.originalQuantity),
  returnedQuantity: money(line.returnedQuantity),
  activeQuantity: money(line.activeQuantity),
  originalAmount: money(line.originalAmount),
  returnedAmount: money(line.returnedAmount),
  activeAmount: money(line.activeAmount),
  snapshot: line.snapshot || null,
});

const loadCurrentDeliveryNoteRevision = async ({ prisma, branchId, saleId }) => {
  if (!prisma?.deliveryNoteDocument) return null;
  const key = currentKeyOf({ branchId, saleId });
  const current = await prisma.deliveryNoteDocument.findUnique({
    where: { currentKey: key },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      returnSources: { orderBy: [{ returnedAt: 'asc' }, { id: 'asc' }] },
      replacesDocument: {
        select: {
          id: true,
          documentNumber: true,
          revisionNumber: true,
          state: true,
        },
      },
    },
  });
  if (!current) return null;

  return Object.freeze({
    source: 'PERSISTED_REVISION',
    id: Number(current.id),
    branchId: Number(current.branchId),
    saleId: Number(current.saleId),
    documentNumber: current.documentNumber,
    revisionNumber: Number(current.revisionNumber),
    revisionKind: current.revisionKind,
    state: current.state,
    replacesDocumentId: current.replacesDocumentId == null ? null : Number(current.replacesDocumentId),
    predecessor: current.replacesDocument
      ? Object.freeze({
          id: Number(current.replacesDocument.id),
          documentNumber: current.replacesDocument.documentNumber,
          revisionNumber: Number(current.replacesDocument.revisionNumber),
          state: current.replacesDocument.state,
        })
      : null,
    grossAmount: money(current.grossAmount),
    returnedAmount: money(current.returnedAmount),
    activeAmount: money(current.activeAmount),
    issuedAt: current.issuedAt,
    snapshot: current.snapshot || null,
    lines: Object.freeze((current.lines || []).map(mapPersistedRevisionLineToPrint)),
    returnSources: Object.freeze((current.returnSources || []).map((row) => Object.freeze({
      saleReturnId: Number(row.saleReturnId),
      returnedAt: row.returnedAt,
      snapshot: row.snapshot || null,
    }))),
  });
};

module.exports = Object.freeze({
  mapPersistedRevisionLineToPrint,
  loadCurrentDeliveryNoteRevision,
});
