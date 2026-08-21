'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  currentKeyOf,
} = require('../src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionAuthority');

const read = (relative) => fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');

assert.equal(currentKeyOf({ branchId: 2, saleId: 1046 }), '2:1046');
assert.equal(currentKeyOf({ branchId: 2, id: 1046 }), '2:1046');
assert.throws(
  () => currentKeyOf({ branchId: 2 }),
  (error) => error?.code === 'DELIVERY_NOTE_CURRENT_KEY_IDENTITY_REQUIRED',
);

const loader = read('src/modules/sales/delivery-note/lifecycle/loadCurrentDeliveryNoteRevision.js');
assert.match(loader, /findUnique\(\{[\s\S]*currentKey: key/);
assert.match(loader, /findFirst\(\{[\s\S]*branchId: normalizedBranchId,[\s\S]*saleId: normalizedSaleId,[\s\S]*state: 'CURRENT'/);
assert.match(loader, /Keep reads immutable and recover those rows/);

const revisionService = read('src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionService.js');
assert.match(revisionService, /const legacyCurrent = await tx\.deliveryNoteDocument\.findFirst/);
assert.match(revisionService, /saleId: Number\(sale\.id\)/);
assert.match(revisionService, /if \(legacyCurrent\) return legacyCurrent/);

console.log('Delivery Note lifecycle Wave 2L current key compatibility contract: PASS');
