'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { projectSaleDeliveryNote } = require('./projectSaleDeliveryNoteService');
const {
  loadCurrentDeliveryNoteRevision,
} = require('../../delivery-note/lifecycle/loadCurrentDeliveryNoteRevision');

const money = (value) => Number(Number(value || 0).toFixed(2));

const projectCurrentSaleDeliveryNote = async ({ branchId, saleId }) => {
  const persistedRevision = await loadCurrentDeliveryNoteRevision({
    prisma,
    branchId,
    saleId,
  });

  const legacyProjection = await projectSaleDeliveryNote({ branchId, saleId });
  if (!persistedRevision) {
    return Object.freeze({
      ...legacyProjection,
      deliveryNoteReadAuthority: Object.freeze({
        source: 'LEGACY_SALE',
        persistedRevision: false,
      }),
    });
  }

  const canonicalReturnedAmount = money(legacyProjection?.deliveryNoteLifecycle?.returnedAmount);
  const revisionReturnedAmount = money(persistedRevision.returnedAmount);
  const hasUnrevisedReturn = canonicalReturnedAmount > revisionReturnedAmount;
  const lifecycleState = hasUnrevisedReturn ? 'ADJUSTED' : 'ACTIVE';

  const document = Object.freeze({
    ...legacyProjection.document,
    documentNumber: persistedRevision.documentNumber,
    issuedAt: persistedRevision.issuedAt,
    totalBeforeDiscount: persistedRevision.activeAmount,
    totalDiscount: 0,
    totalAmount: persistedRevision.activeAmount,
    lifecycleState,
    grossAmount: persistedRevision.grossAmount,
    returnedAmount: persistedRevision.returnedAmount,
    activeAmount: persistedRevision.activeAmount,
    revision: Object.freeze({
      id: persistedRevision.id,
      revisionNumber: persistedRevision.revisionNumber,
      revisionKind: persistedRevision.revisionKind,
      state: persistedRevision.state,
      replacesDocumentId: persistedRevision.replacesDocumentId,
      predecessor: persistedRevision.predecessor,
      returnSources: persistedRevision.returnSources,
    }),
    // Financial-lock replacement belongs to a different authority and must not
    // overwrite the first-class return-adjusted Delivery Note revision.
    replacement: null,
  });

  return Object.freeze({
    ...legacyProjection,
    document,
    lines: persistedRevision.lines,
    replacementProjection: null,
    deliveryNoteLifecycle: Object.freeze({
      ...legacyProjection.deliveryNoteLifecycle,
      lifecycleState,
      grossAmount: persistedRevision.grossAmount,
      returnedAmount: persistedRevision.returnedAmount,
      activeAmount: persistedRevision.activeAmount,
      persistedRevision: true,
      currentRevisionId: persistedRevision.id,
      currentRevisionNumber: persistedRevision.revisionNumber,
      currentRevisionKind: persistedRevision.revisionKind,
      hasUnrevisedReturn,
    }),
    deliveryNoteReadAuthority: Object.freeze({
      source: 'PERSISTED_REVISION',
      persistedRevision: true,
      currentRevisionId: persistedRevision.id,
      currentRevisionNumber: persistedRevision.revisionNumber,
      documentNumber: persistedRevision.documentNumber,
      hasUnrevisedReturn,
    }),
  });
};

module.exports = Object.freeze({ projectCurrentSaleDeliveryNote });
