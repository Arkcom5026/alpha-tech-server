'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const history = read('src/modules/finance/combined-billing/unifiedDocumentHistoryController.js');
const printProjection = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');

assert.match(
  printProjection,
  /sale\.status === 'CANCELLED'/,
  'canonical Sale delivery-note projection must reject cancelled sales',
);
assert.doesNotMatch(
  printProjection,
  /sale\.status !== 'COMPLETED'/,
  'valid credit delivery notes must not depend on COMPLETED Sale status',
);
assert.match(
  printProjection,
  /!sale\.officialDocumentNumber/,
  'canonical Sale delivery-note projection must require an issued document number',
);
assert.match(
  printProjection,
  /DELIVERY_NOTE_ALREADY_CONSOLIDATED/,
  'a consolidated source delivery note must leave active print authority',
);

assert.match(
  history,
  /status:\s*\{\s*not:\s*'CANCELLED'\s*\}[\s\S]*?purpose === 'DELIVERY_NOTE'[\s\S]*?officialDocumentNumber:\s*\{\s*not:\s*null\s*\}/,
  'Delivery Note discovery must include issued non-cancelled Sales, including valid credit DRAFT sales',
);
assert.doesNotMatch(
  history,
  /purpose === 'DELIVERY_NOTE'[\s\S]{0,250}?status:\s*'COMPLETED'/,
  'Delivery Note discovery must not collapse credit lifecycle into COMPLETED-only semantics',
);
assert.match(
  history,
  /consumedSourceExclusion/,
  'active Delivery Note history must suppress source Sales already represented by consolidated delivery',
);

console.log('Delivery Note history/print eligibility authority contract: PASS');
