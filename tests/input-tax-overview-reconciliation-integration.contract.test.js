'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const overviewService = read(
  'src/modules/tax/inputDocuments/overview/inputTaxOverviewService.js',
);
const reconciliationContract = read(
  'src/modules/tax/inputDocuments/reconciliation/inputTaxReconciliationContract.js',
);
const reconciliationService = read(
  'src/modules/tax/inputDocuments/reconciliation/inputTaxDocumentReconciliationService.js',
);

assert.match(overviewService, /inputTaxReconciliationContract/);
assert.match(overviewService, /projectDocumentReconciliation/);
assert.match(overviewService, /createReconciliationProjection/);
assert.match(overviewService, /PARTIALLY_RECONCILED/);
assert.match(overviewService, /OVER_ALLOCATED/);
assert.match(overviewService, /reconciliationStatus: reconciliation\.status/);
assert.match(overviewService, /attentionReasons: reconciliation\.qualityCodes/);
assert.match(overviewService, /reconciliation,/);
assert.doesNotMatch(overviewService, /reconciliationStatus: row\.linkedReceiptCount === 0/);
assert.match(reconciliationContract, /UNLINKED/);
assert.match(reconciliationContract, /RECONCILED/);
assert.match(reconciliationContract, /OVER_ALLOCATED/);
assert.match(reconciliationService, /createReconciliationProjection/);
assert.match(reconciliationService, /INPUT_TAX_RECONCILIATION_REQUIRED/);

console.log('Input-tax overview reconciliation integration contract: PASS');
