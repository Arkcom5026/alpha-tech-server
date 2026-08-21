'use strict';

const assert = require('node:assert/strict');
const {
  projectDeliveryNoteHistoryLifecycle,
  mergeDeliveryNoteLifecycleIntoHistoryRow,
} = require('../src/modules/sales/delivery-note/lifecycle/projectDeliveryNoteHistoryLifecycle');

const sale = {
  id: 1046,
  code: 'SL-022608-0077',
  officialDocumentNumber: 'DN-SL-022608-0077',
  status: 'DRAFT',
  totalAmount: 1810,
  paidAmount: 0,
  items: [{ id: 10, price: 1170, returnedQuantity: 0 }],
  simpleItems: [{ id: 20, quantity: 2, price: 640, returnedQuantity: 2 }],
};

const adjusted = projectDeliveryNoteHistoryLifecycle({ sale });
assert.equal(adjusted.lifecycleState, 'ADJUSTED');
assert.equal(adjusted.grossAmount, 1810);
assert.equal(adjusted.returnedAmount, 640);
assert.equal(adjusted.activeAmount, 1170);
assert.equal(adjusted.balanceAmount, 1170);
assert.equal(adjusted.lifecycleHistoricalReadable, true);
assert.equal(adjusted.lifecycleCurrentAuthority, true);
assert.equal(adjusted.lifecycleActions.canCreateAdjustedRevision, true);
assert.equal(adjusted.lifecycleActions.canConsolidate, true);
assert.equal(adjusted.lifecycleActions.canTaxHandoff, true);

const partiallyPaid = projectDeliveryNoteHistoryLifecycle({
  sale: { ...sale, paidAmount: 300 },
  payment: { paidAmount: 300 },
});
assert.equal(partiallyPaid.balanceAmount, 870);

const consolidated = projectDeliveryNoteHistoryLifecycle({
  sale,
  activeConsolidation: { combinedBillingId: 88 },
});
assert.equal(consolidated.lifecycleState, 'CONSOLIDATED');
assert.equal(consolidated.lifecycleHistoricalReadable, true);
assert.equal(consolidated.lifecycleCurrentAuthority, false);
assert.equal(consolidated.lifecycleActions.canConsolidate, false);
assert.deepEqual(consolidated.activeConsolidation, { combinedBillingId: 88 });

const taxLocked = projectDeliveryNoteHistoryLifecycle({
  sale,
  taxDocument: { id: 501, issuedDocumentNumber: 'TAX-000501', taxInvoiceKind: 'FULL' },
});
assert.equal(taxLocked.lifecycleState, 'ADJUSTED');
assert.equal(taxLocked.lifecycleActions.canCreateAdjustedRevision, false);
assert.equal(taxLocked.lifecycleActions.canConsolidate, false);
assert.equal(taxLocked.lifecycleActions.canTaxHandoff, false);
assert.equal(taxLocked.lifecycleActions.requiresStatutoryCorrection, true);

const merged = mergeDeliveryNoteLifecycleIntoHistoryRow({
  row: {
    id: sale.id,
    code: sale.code,
    totalAmount: 1810,
    paidAmount: 0,
    balanceAmount: 1810,
    documentSourceType: 'SALE',
    documentSourceId: sale.id,
  },
  sale,
});
assert.equal(merged.totalAmount, 1810, 'legacy historical gross field must stay unchanged');
assert.equal(merged.grossTotalAmount, 1810);
assert.equal(merged.returnedAmount, 640);
assert.equal(merged.billableAmount, 1170);
assert.equal(merged.balanceAmount, 1170);
assert.equal(merged.lifecycleState, 'ADJUSTED');
assert.equal(merged.documentSourceType, 'SALE');
assert.equal(merged.documentSourceId, 1046);

console.log('Delivery Note lifecycle Wave 1C history projection contract: PASS');
