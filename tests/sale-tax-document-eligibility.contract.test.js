'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const {
  assertSaleTaxDocumentEligibility,
} = require('../src/modules/tax/sources/sale/saleTaxDocumentEligibilityPolicy');

assert.doesNotThrow(() => {
  assertSaleTaxDocumentEligibility({ statusPayment: 'PAID' });
});

for (const statusPayment of ['UNPAID', 'PARTIAL', 'PENDING', null, undefined]) {
  assert.throws(
    () => assertSaleTaxDocumentEligibility({ statusPayment }),
    (error) => error.code === 'TAX_SOURCE_SALE_PAYMENT_REQUIRED' && error.statusCode === 409,
    `Expected ${statusPayment || 'missing'} payment to be rejected`,
  );
}

const manual = read('docs/workflows/core-sales-business-operation-manual.md');
const workflow = read('docs/workflows/core-sales-workflow-contract.md');

assert.match(manual, /tax invoice is permitted only when the Sale payment projection is `PAID`/i);
assert.match(manual, /must not issue a short tax invoice or a full tax invoice/i);
assert.match(workflow, /short tax invoice or full tax invoice is forbidden until the payment projection is `PAID`/i);
assert.match(workflow, /permitted initial document is `DELIVERY_NOTE`/);

console.log('Sale tax-document payment eligibility contract: PASS');
