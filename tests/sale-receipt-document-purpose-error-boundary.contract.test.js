'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const controller = read(
  'src/modules/sales/payment/query/printable/searchPrintablePaymentsController.js',
);

// Existing printable payment projection remains additive and backward-compatible.
assert.match(controller, /\.\.\.payment,\s*amount:\s*Number\(total\.toFixed\(2\)\),\s*documentPurpose,/s);
assert.match(controller, /branchId,\s*isCancelled:\s*false/s);
assert.match(controller, /status:\s*\{\s*not:\s*'CANCELLED'\s*\}/s);

// Document Purpose failures must remain visible at the HTTP boundary instead of
// being collapsed into the generic printable-payment 500 response.
assert.match(controller, /const isDocumentPurposeError = \(error\) =>/);
assert.match(controller, /error\.code\.startsWith\('DOCUMENT_PURPOSE_'\)/);
assert.match(controller, /Number\.isInteger\(error\?\.statusCode\)/);
assert.match(controller, /if \(isDocumentPurposeError\(error\)\)/);
assert.match(controller, /res\.status\(error\.statusCode\)\.json\(\{/);
assert.match(controller, /code:\s*error\.code/);
assert.match(controller, /message:\s*error\.message/);
assert.match(controller, /error\.detail !== undefined/);

// Unrelated runtime failures preserve the legacy generic error response.
assert.match(
  controller,
  /res\.status\(500\)\.json\(\{ message: 'ไม่สามารถโหลดข้อมูลใบเสร็จได้' \}\)/,
);

console.log('Sale receipt document-purpose error-boundary contract: PASS');
