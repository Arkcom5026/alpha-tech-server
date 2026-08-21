'use strict';

const assert = require('node:assert/strict');
const {
  DELIVERY_NOTE_LIFECYCLE_STATE,
  projectDeliveryNoteLineState,
  resolveLegacySaleBackedDeliveryNote,
  resolveDeliveryNoteActions,
} = require('../src/modules/sales/delivery-note/lifecycle/deliveryNoteLifecycleDomain');

const referenceSale = {
  id: 1046,
  code: 'SL-022608-0077',
  officialDocumentNumber: 'DN-SL-022608-0077',
  status: 'DRAFT',
  totalAmount: 1810,
  items: [
    { id: 1, price: 1170, returnedQuantity: 0 },
  ],
  simpleItems: [
    { id: 2, quantity: 2, price: 640, returnedQuantity: 2 },
  ],
};

const lineState = projectDeliveryNoteLineState(referenceSale);
assert.equal(lineState.totals.originalAmount, 1810);
assert.equal(lineState.totals.returnedAmount, 640);
assert.equal(lineState.totals.activeAmount, 1170);
assert.equal(lineState.activeLines.length, 1);
assert.equal(lineState.activeLines[0].lineType, 'STOCK');
assert.equal(lineState.activeLines[0].activeLineAmount, 1170);

const adjusted = resolveLegacySaleBackedDeliveryNote({ sale: referenceSale });
assert.equal(adjusted.lifecycleState, DELIVERY_NOTE_LIFECYCLE_STATE.ADJUSTED);
assert.equal(adjusted.grossAmount, 1810);
assert.equal(adjusted.returnedAmount, 640);
assert.equal(adjusted.activeAmount, 1170);
assert.equal(adjusted.actions.historicalReadable, true);
assert.equal(adjusted.actions.canPrintCurrent, true);
assert.equal(adjusted.actions.canCreateAdjustedRevision, true);
assert.equal(adjusted.actions.canConsolidate, true);
assert.equal(adjusted.actions.canTaxHandoff, true);

const active = resolveLegacySaleBackedDeliveryNote({
  sale: {
    ...referenceSale,
    simpleItems: [{ id: 2, quantity: 2, price: 640, returnedQuantity: 0 }],
  },
});
assert.equal(active.lifecycleState, DELIVERY_NOTE_LIFECYCLE_STATE.ACTIVE);
assert.equal(active.activeAmount, 1810);
assert.equal(active.actions.canCreateAdjustedRevision, false);
assert.equal(active.actions.canConsolidate, true);

const consolidated = resolveLegacySaleBackedDeliveryNote({
  sale: referenceSale,
  hasActiveConsolidation: true,
});
assert.equal(consolidated.lifecycleState, DELIVERY_NOTE_LIFECYCLE_STATE.CONSOLIDATED);
assert.equal(consolidated.actions.historicalReadable, true);
assert.equal(consolidated.actions.canPrintCurrent, false);
assert.equal(consolidated.actions.canConsolidate, false);
assert.equal(consolidated.actions.canTaxHandoff, false);

const superseded = resolveLegacySaleBackedDeliveryNote({
  sale: referenceSale,
  hasSuccessor: true,
});
assert.equal(superseded.lifecycleState, DELIVERY_NOTE_LIFECYCLE_STATE.SUPERSEDED);
assert.equal(superseded.actions.historicalReadable, true);
assert.equal(superseded.actions.canPrintCurrent, false);

const cancelled = resolveLegacySaleBackedDeliveryNote({
  sale: { ...referenceSale, status: 'CANCELLED' },
});
assert.equal(cancelled.lifecycleState, DELIVERY_NOTE_LIFECYCLE_STATE.CANCELLED);
assert.equal(cancelled.actions.historicalReadable, true);
assert.equal(cancelled.actions.canPrintCurrent, false);

const afterTaxReturn = resolveLegacySaleBackedDeliveryNote({
  sale: referenceSale,
  taxIssued: true,
});
assert.equal(afterTaxReturn.lifecycleState, DELIVERY_NOTE_LIFECYCLE_STATE.ADJUSTED);
assert.equal(afterTaxReturn.actions.canCreateAdjustedRevision, false);
assert.equal(afterTaxReturn.actions.canConsolidate, false);
assert.equal(afterTaxReturn.actions.canTaxHandoff, false);
assert.equal(afterTaxReturn.actions.requiresStatutoryCorrection, true);

assert.throws(
  () => resolveLegacySaleBackedDeliveryNote({
    sale: referenceSale,
    hasSuccessor: true,
    hasActiveConsolidation: true,
  }),
  (error) => error?.code === 'DELIVERY_NOTE_LIFECYCLE_CONSUMPTION_CONFLICT',
);

const zeroActiveActions = resolveDeliveryNoteActions({
  state: DELIVERY_NOTE_LIFECYCLE_STATE.ADJUSTED,
  activeAmount: 0,
});
assert.equal(zeroActiveActions.canCreateAdjustedRevision, false);
assert.equal(zeroActiveActions.canConsolidate, false);
assert.equal(zeroActiveActions.canTaxHandoff, false);

console.log('Delivery Note lifecycle domain foundation contract: PASS');
