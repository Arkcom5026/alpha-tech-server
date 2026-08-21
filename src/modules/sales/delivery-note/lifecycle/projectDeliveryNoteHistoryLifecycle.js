'use strict';

const {
  resolveLegacySaleBackedDeliveryNote,
} = require('./deliveryNoteLifecycleDomain');

const money = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value) => Number(money(value).toFixed(2));

const projectDeliveryNoteHistoryLifecycle = ({
  sale,
  payment = null,
  taxDocument = null,
  activeConsolidation = null,
} = {}) => {
  if (!sale) {
    const error = new Error('Sale-backed Delivery Note source is required for history projection');
    error.code = 'DELIVERY_NOTE_HISTORY_SOURCE_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const lifecycle = resolveLegacySaleBackedDeliveryNote({
    sale,
    // A persisted Delivery Note revision/successor does not exist until Wave 2.
    hasSuccessor: false,
    hasActiveConsolidation: Boolean(activeConsolidation),
    taxIssued: Boolean(taxDocument),
  });

  const storedPaidAmount = sale.paidAmount == null ? 0 : money(sale.paidAmount);
  const projectedPaidAmount = money(payment?.paidAmount);
  const paidAmount = round2(Math.max(storedPaidAmount, projectedPaidAmount));
  const balanceAmount = round2(Math.max(0, lifecycle.activeAmount - paidAmount));

  return Object.freeze({
    lifecycleState: lifecycle.lifecycleState,
    lifecycleActions: lifecycle.actions,
    lifecycleHistoricalReadable: lifecycle.actions.historicalReadable === true,
    lifecycleCurrentAuthority: lifecycle.actions.canPrintCurrent === true,
    grossAmount: lifecycle.grossAmount,
    returnedAmount: lifecycle.returnedAmount,
    activeAmount: lifecycle.activeAmount,
    paidAmount,
    balanceAmount,
    hasReturn: lifecycle.returnedAmount > 0,
    activeConsolidation: activeConsolidation
      ? Object.freeze({
          combinedBillingId: Number(activeConsolidation.combinedBillingId),
        })
      : null,
    issuedTaxDocument: taxDocument
      ? Object.freeze({
          id: Number(taxDocument.id),
          issuedDocumentNumber: taxDocument.issuedDocumentNumber || null,
          taxInvoiceKind: taxDocument.taxInvoiceKind || null,
        })
      : null,
  });
};

const mergeDeliveryNoteLifecycleIntoHistoryRow = ({
  row,
  sale,
  payment = null,
  taxDocument = null,
  activeConsolidation = null,
} = {}) => {
  const lifecycle = projectDeliveryNoteHistoryLifecycle({
    sale,
    payment,
    taxDocument,
    activeConsolidation,
  });

  return Object.freeze({
    ...row,
    lifecycleState: lifecycle.lifecycleState,
    lifecycleActions: lifecycle.lifecycleActions,
    lifecycleHistoricalReadable: lifecycle.lifecycleHistoricalReadable,
    lifecycleCurrentAuthority: lifecycle.lifecycleCurrentAuthority,
    grossTotalAmount: lifecycle.grossAmount,
    returnedAmount: lifecycle.returnedAmount,
    billableAmount: lifecycle.activeAmount,
    paidAmount: lifecycle.paidAmount,
    balanceAmount: lifecycle.balanceAmount,
    hasReturn: lifecycle.hasReturn,
    activeConsolidation: lifecycle.activeConsolidation,
    lifecycleTaxDocument: lifecycle.issuedTaxDocument,
  });
};

module.exports = Object.freeze({
  projectDeliveryNoteHistoryLifecycle,
  mergeDeliveryNoteLifecycleIntoHistoryRow,
});
