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
  /sale\.status !== 'COMPLETED'/,
  'canonical Sale delivery-note projection must remain fail-closed for non-completed sales',
);
assert.match(
  printProjection,
  /Boolean\(sale\.officialDocumentNumber\)/,
  'canonical Sale delivery-note projection must require an issued official document number',
);

assert.match(
  history,
  /purpose === 'DELIVERY_NOTE'[\s\S]*?status:\s*'COMPLETED'[\s\S]*?officialDocumentNumber:\s*\{\s*not:\s*null\s*\}/,
  'Delivery Note discovery must advertise only Sales that satisfy the canonical printable eligibility',
);
assert.match(
  history,
  /purpose === 'DELIVERY_NOTE'[\s\S]*?:\s*\{[\s\S]*?status:\s*\{\s*not:\s*'CANCELLED'\s*\}/,
  'Bill discovery must preserve the broader non-cancelled Sale lifecycle instead of inheriting Delivery Note completion semantics',
);
assert.match(
  history,
  /projectSaleDeliveryNote requires a completed sale plus an issued[\s\S]*official document number/,
  'the shared eligibility boundary should stay explicit beside the discovery query',
);

console.log('Delivery Note history/print eligibility authority contract: PASS');
