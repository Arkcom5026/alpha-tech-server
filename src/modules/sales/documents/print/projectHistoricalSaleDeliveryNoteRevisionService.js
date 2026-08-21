'use strict';

const { prisma } = require('../../../../../lib/prisma');
const { getDeliveryNoteRevisionById } = require('../../delivery-note/lifecycle/deliveryNoteRevisionHistoryService');
const { projectSaleDeliveryNote } = require('./projectSaleDeliveryNoteService');

const composeHistoricalRevisionPrintProjection = ({ revision, legacyProjection }) => {
  const lifecycleActions = Object.freeze({
    canCreateAdjustedRevision: false,
    canConsolidate: false,
    canInvoice: false,
    canPrintHistorical: true,
  });
  const document = Object.freeze({
    ...legacyProjection.document,
    documentNumber: revision.documentNumber,
    issuedAt: revision.issuedAt,
    totalBeforeDiscount: revision.activeAmount,
    totalDiscount: 0,
    totalAmount: revision.activeAmount,
    lifecycleState: revision.state,
    grossAmount: revision.grossAmount,
    returnedAmount: revision.returnedAmount,
    activeAmount: revision.activeAmount,
    historicalPrint: true,
    currentAuthority: revision.currentAuthority,
    lifecycleActions,
    revision: Object.freeze({
      id: revision.id,
      revisionNumber: revision.revisionNumber,
      revisionKind: revision.revisionKind,
      state: revision.state,
      predecessor: revision.predecessor,
      successor: revision.successor,
      returnSources: revision.returnSources,
    }),
    replacement: null,
  });

  return Object.freeze({
    ...legacyProjection,
    document,
    lines: revision.lines,
    replacementProjection: null,
    deliveryNoteLifecycle: Object.freeze({
      lifecycleState: revision.state,
      historicalReadable: true,
      currentAuthority: revision.currentAuthority,
      grossAmount: revision.grossAmount,
      returnedAmount: revision.returnedAmount,
      activeAmount: revision.activeAmount,
      persistedRevision: true,
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      revisionKind: revision.revisionKind,
      predecessor: revision.predecessor,
      successor: revision.successor,
      returnSources: revision.returnSources,
      actions: lifecycleActions,
    }),
    deliveryNoteReadAuthority: Object.freeze({
      source: 'PERSISTED_HISTORICAL_REVISION',
      persistedRevision: true,
      historicalPrint: true,
      revisionId: revision.id,
      revisionNumber: revision.revisionNumber,
      documentNumber: revision.documentNumber,
      state: revision.state,
      currentAuthority: revision.currentAuthority,
    }),
  });
};

const projectHistoricalSaleDeliveryNoteRevision = async ({ branchId, saleId, revisionId }) => {
  // Resolve immutable lineage first. If the requested revision does not exist,
  // fail before touching presentation snapshot authority for the Sale.
  const revision = await getDeliveryNoteRevisionById({ prisma, branchId, saleId, revisionId });
  const legacyProjection = await projectSaleDeliveryNote({ branchId, saleId, historicalRead: true });

  return composeHistoricalRevisionPrintProjection({ revision, legacyProjection });
};

module.exports = Object.freeze({
  composeHistoricalRevisionPrintProjection,
  projectHistoricalSaleDeliveryNoteRevision,
});
