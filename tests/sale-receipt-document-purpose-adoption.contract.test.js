'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const controller = read(
  'src/modules/sales/payment/query/printable/searchPrintablePaymentsController.js',
);
const routes = read('src/modules/sales/payment/routes/paymentRoutes.js');

assert.match(controller, /ResolvePrintDocumentPurposeService/);
assert.match(controller, /branchId,\s*code:\s*'SALE_RECEIPT'/s);
assert.match(controller, /documentPurpose\s*=\s*Object\.freeze/);
assert.match(controller, /code:\s*purpose\.code/);
assert.match(controller, /displayName:\s*purpose\.displayName/);
assert.match(controller, /currentVersion:\s*purpose\.currentVersion/);
assert.match(controller, /\.\.\.payment,\s*amount:/s);
assert.match(controller, /documentPurpose,/);
assert.match(controller, /branchId,\s*isCancelled:\s*false/s);
assert.match(controller, /status:\s*\{\s*not:\s*'CANCELLED'\s*\}/s);
assert.match(routes, /router\.get\('\/printable',\s*searchPrintablePayments\)/);

assert.doesNotMatch(controller, /customerReceipt/i);
assert.doesNotMatch(controller, /CustomerReceipts/);

console.log('Sale receipt document-purpose adoption contract: PASS');
