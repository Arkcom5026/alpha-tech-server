'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const verifier = fs.readFileSync(
  path.join(root, 'scripts/verify-output-tax-credit-note-outcome.js'),
  'utf8',
);

assert.match(verifier, /BEGIN READ ONLY/);
assert.match(verifier, /assertTestDatabaseAuthority/);
assert.match(verifier, /databaseModified: false/);
assert.match(verifier, /OUTPUT_TAX_CREDIT_NOTE/);
assert.match(verifier, /OUTPUT_TAX_INVOICE/);
assert.match(verifier, /saleReturnStatus !== 'COMPLETED'/);
assert.match(verifier, /row\.isFullyRefunded !== true/);
assert.match(verifier, /Cross-branch tax-credit-note evidence/);
assert.match(verifier, /full, zero-deduction refund/);
assert.match(verifier, /originalIssuedDocumentNumber/);

console.log('Output tax credit-note outcome verifier contract: PASS');
