'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const verifier = read('scripts/verify-output-tax-issuance-outcome.js');

assert.match(verifier, /BEGIN READ ONLY/);
assert.match(verifier, /assertTestDatabaseAuthority/);
assert.match(verifier, /databaseModified: false/);
assert.match(verifier, /OUTPUT_TAX_INVOICE/);
assert.match(verifier, /sourceType !== 'SALE'/);
assert.match(verifier, /status !== 'REGISTERED'/);
assert.match(verifier, /sale\.paid !== true/);
assert.match(verifier, /sale\.statusPayment !== 'PAID'/);
assert.match(verifier, /DRAFT' && event\.toStatus === 'REGISTERED'/);
assert.match(verifier, /recipientSnapshot/);
assert.match(verifier, /Short tax invoice must not retain a recipient snapshot/);

console.log('Output tax issuance outcome verifier contract: PASS');
