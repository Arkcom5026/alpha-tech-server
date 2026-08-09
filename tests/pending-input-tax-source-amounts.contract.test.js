'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const repository = fs.readFileSync(path.join(
  __dirname,
  '../src/modules/tax/inputDocuments/pending/pendingInputTaxDocumentRepository.js'
), 'utf8');

assert.match(repository, /quick\."documentSubtotal"/);
assert.match(repository, /quick\."documentVatAmount"/);
assert.match(repository, /quick\."documentTotalAmount"/);
assert.match(repository, /SUM\(item\."quantity" \* item\."costPrice"\)/);
assert.match(repository, /SUM\(link\."allocatedSubtotal"\)/);
assert.match(repository, /SUM\(link\."allocatedVatAmount"\)/);
assert.match(repository, /"remainingSubtotalAmount"/);
assert.match(repository, /"remainingVatAmount"/);
assert.match(repository, /"remainingTotalAmount"/);
assert.doesNotMatch(repository, /(?:\/\s*1\.07|\*\s*0\.07|vatRate\s*=\s*7)/);

console.log('pending-input-tax-source-amounts.contract.test.js: PASS');
