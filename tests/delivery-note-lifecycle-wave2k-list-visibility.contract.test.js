'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  normalizeSaleIds,
  summarizeLegacyReturnLines,
  projectLifecycleSummary,
} = require('../src/modules/sales/delivery-note/list/deliveryNoteListLifecycleService');

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

assert.deepEqual(normalizeSaleIds(['1046', 1046, '1047', 'bad']), [1046, 1047]);

const partialReturn = summarizeLegacyReturnLines({
  items: [
    { returnedQuantity: 0 },
    { returnedQuantity: 1 },
  ],
  simpleItems: [
    { quantity: 3, returnedQuantity: 1 },
  ],
});
assert.equal(partialReturn.hasReturnActivity, true);
assert.equal(partialReturn.fullyReturned, false);
assert.equal(partialReturn.returnedLineCount, 2);
assert.equal(partialReturn.returnedQuantity, 2);

const legacyPending = projectLifecycleSummary({
  sale: {
    id: 1046,
    items: [],
    simpleItems: [
      { quantity: 3, returnedQuantity: 0 },
      { quantity: 2, returnedQuantity: 2 },
    ],
  },
  currentDocument: null,
});
assert.equal(legacyPending.lifecycleStatus, 'RETURNED_PENDING_REVISION');
assert.equal(legacyPending.hasReturnActivity, true);
assert.equal(legacyPending.currentRevision, null);

const adjustedCurrent = projectLifecycleSummary({
  sale: {
    id: 1046,
    items: [],
    simpleItems: [
      { quantity: 3, returnedQuantity: 0 },
      { quantity: 2, returnedQuantity: 2 },
    ],
  },
  currentDocument: {
    id: 22,
    documentNumber: 'SL-022608-0077-R2',
    revisionNumber: 2,
    revisionKind: 'RETURN_ADJUSTMENT',
    state: 'CURRENT',
    activeAmount: 1170,
    returnedAmount: 640,
  },
});
assert.equal(adjustedCurrent.lifecycleStatus, 'RETURN_ADJUSTED_CURRENT');
assert.equal(adjustedCurrent.currentRevision.revisionNumber, 2);
assert.equal(adjustedCurrent.currentRevision.activeAmount, 1170);
assert.equal(adjustedCurrent.currentRevision.returnedAmount, 640);

const fullyReturned = projectLifecycleSummary({
  sale: {
    id: 2000,
    items: [{ returnedQuantity: 1 }],
    simpleItems: [],
  },
  currentDocument: null,
});
assert.equal(fullyReturned.lifecycleStatus, 'FULLY_RETURNED');

const serviceSource = read('src/modules/sales/delivery-note/list/deliveryNoteListLifecycleService.js');
const controllerSource = read('src/modules/sales/delivery-note/list/deliveryNoteListLifecycleController.js');
const routeSource = read('src/modules/sales/routes/saleRoutes.js');
assert.match(serviceSource, /Promise\.all\(\[/);
assert.match(serviceSource, /db\.sale\.findMany/);
assert.match(serviceSource, /db\.deliveryNoteDocument\.findMany/);
assert.doesNotMatch(serviceSource, /for \([^)]*\)[\s\S]*await db\./);
assert.match(controllerSource, /saleIds: parseSaleIds\(req\.query\?\.saleIds\)/);
assert.match(routeSource, /router\.get\('\/delivery-note\/lifecycle-summaries', allowSalesCore, getDeliveryNoteListLifecycleSummaries\)/);

console.log('Delivery Note lifecycle Wave 2K list visibility contract: PASS');
