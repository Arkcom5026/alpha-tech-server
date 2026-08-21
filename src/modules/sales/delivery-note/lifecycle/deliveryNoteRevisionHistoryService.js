'use strict';

const { mapPersistedRevisionLineToPrint } = require('./loadCurrentDeliveryNoteRevision');

const fail = (code, message, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
};

const positiveInt = (value, code, field) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail(code, `${field} must be a positive integer`);
  return parsed;
};

const money = (value) => Number(Number(value || 0).toFixed(2));

const mapRevisionSummary = (row) => Object.freeze({
  id: Number(row.id),
  branchId: Number(row.branchId),
  saleId: Number(row.saleId),
  documentNumber: row.documentNumber,
  revisionNumber: Number(row.revisionNumber),
  revisionKind: row.revisionKind,
  state: row.state,
  currentAuthority: row.state === 'CURRENT',
  historicalReadable: true,
  grossAmount: money(row.grossAmount),
  returnedAmount: money(row.returnedAmount),
  activeAmount: money(row.activeAmount),
  issuedAt: row.issuedAt,
  supersededAt: row.supersededAt || null,
  consolidatedAt: row.consolidatedAt || null,
  cancelledAt: row.cancelledAt || null,
  replacesDocumentId: row.replacesDocumentId == null ? null : Number(row.replacesDocumentId),
  predecessor: row.replacesDocument ? Object.freeze({
    id: Number(row.replacesDocument.id),
    documentNumber: row.replacesDocument.documentNumber,
    revisionNumber: Number(row.replacesDocument.revisionNumber),
    state: row.replacesDocument.state,
  }) : null,
  successor: row.successorDocument ? Object.freeze({
    id: Number(row.successorDocument.id),
    documentNumber: row.successorDocument.documentNumber,
    revisionNumber: Number(row.successorDocument.revisionNumber),
    state: row.successorDocument.state,
  }) : null,
});

const listDeliveryNoteRevisionHistory = async ({ prisma, branchId, saleId }) => {
  if (!prisma?.deliveryNoteDocument) {
    return Object.freeze({
      saleId: Number(saleId),
      hasPersistedRevisions: false,
      legacyFallbackAvailable: true,
      currentRevisionId: null,
      revisions: Object.freeze([]),
    });
  }
  const normalizedBranchId = positiveInt(branchId, 'DELIVERY_NOTE_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DELIVERY_NOTE_SALE_REQUIRED', 'saleId');

  const rows = await prisma.deliveryNoteDocument.findMany({
    where: { branchId: normalizedBranchId, saleId: normalizedSaleId },
    orderBy: [{ revisionNumber: 'asc' }, { id: 'asc' }],
    include: {
      replacesDocument: { select: { id: true, documentNumber: true, revisionNumber: true, state: true } },
      successorDocument: { select: { id: true, documentNumber: true, revisionNumber: true, state: true } },
    },
  });

  const revisions = Object.freeze(rows.map(mapRevisionSummary));
  const current = revisions.find((row) => row.currentAuthority) || null;
  return Object.freeze({
    saleId: normalizedSaleId,
    hasPersistedRevisions: revisions.length > 0,
    legacyFallbackAvailable: revisions.length === 0,
    currentRevisionId: current?.id || null,
    revisions,
  });
};

const getDeliveryNoteRevisionById = async ({ prisma, branchId, saleId, revisionId }) => {
  if (!prisma?.deliveryNoteDocument) {
    fail('DELIVERY_NOTE_REVISION_PERSISTENCE_UNAVAILABLE', 'Delivery Note revision persistence is not available', 409);
  }
  const normalizedBranchId = positiveInt(branchId, 'DELIVERY_NOTE_BRANCH_REQUIRED', 'branchId');
  const normalizedSaleId = positiveInt(saleId, 'DELIVERY_NOTE_SALE_REQUIRED', 'saleId');
  const normalizedRevisionId = positiveInt(revisionId, 'DELIVERY_NOTE_REVISION_ID_REQUIRED', 'revisionId');

  const row = await prisma.deliveryNoteDocument.findFirst({
    where: { id: normalizedRevisionId, branchId: normalizedBranchId, saleId: normalizedSaleId },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      returnSources: { orderBy: [{ returnedAt: 'asc' }, { id: 'asc' }] },
      replacesDocument: { select: { id: true, documentNumber: true, revisionNumber: true, state: true } },
      successorDocument: { select: { id: true, documentNumber: true, revisionNumber: true, state: true } },
    },
  });
  if (!row) fail('DELIVERY_NOTE_REVISION_NOT_FOUND', 'Delivery Note revision was not found', 404);

  return Object.freeze({
    ...mapRevisionSummary(row),
    snapshot: row.snapshot || null,
    lines: Object.freeze((row.lines || []).map(mapPersistedRevisionLineToPrint)),
    returnSources: Object.freeze((row.returnSources || []).map((source) => Object.freeze({
      saleReturnId: Number(source.saleReturnId),
      returnedAt: source.returnedAt,
      snapshot: source.snapshot || null,
    }))),
  });
};

module.exports = Object.freeze({
  mapRevisionSummary,
  listDeliveryNoteRevisionHistory,
  getDeliveryNoteRevisionById,
});
