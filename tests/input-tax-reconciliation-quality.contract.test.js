'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const contract = read('src/modules/tax/inputDocuments/reconciliation/inputTaxReconciliationContract.js');
const service = read('src/modules/tax/inputDocuments/reconciliation/inputTaxDocumentReconciliationService.js');

assert.match(contract, /UNLINKED/);
assert.match(contract, /PARTIALLY_RECONCILED/);
assert.match(contract, /RECONCILED/);
assert.match(contract, /OVER_ALLOCATED/);
assert.match(contract, /MONEY_TOLERANCE = '0\.01'/);
assert.match(contract, /qualityCodes/);

assert.match(service, /resolveStatus/);
assert.match(service, /OVER_ALLOCATED/);
assert.match(service, /PARTIALLY_RECONCILED/);
assert.match(service, /moneyString/);
assert.match(service, /createReconciliationProjection/);
assert.doesNotMatch(service, /status: reconciled \? 'RECONCILED' : 'UNRECONCILED'/);

console.log('Input-tax reconciliation and quality contract: PASS');
