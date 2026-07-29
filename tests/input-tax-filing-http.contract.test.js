'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const controller = read('src/modules/tax/inputDocuments/filing/inputTaxFilingController.js');
const routes = read('src/modules/tax/inputDocuments/filing/inputTaxFilingRoutes.js');
const rootRoutes = read('src/modules/tax/http/taxIntakeRoutes.js');

assert.match(controller, /INPUT_TAX_FILING_ACCESS_FORBIDDEN/);
assert.match(controller, /INPUT_TAX_FILING_BRANCH_FORBIDDEN/);
assert.match(controller, /INPUT_TAX_FILING_BATCH_BRANCH_MISMATCH/);
assert.match(controller, /assertBatchPeriodMutable/);
assert.match(controller, /selectTaxDocumentForFiling/);
assert.match(controller, /removeTaxDocumentFromFiling/);
assert.match(controller, /markInputTaxBatchFiled/);
assert.match(routes, /batches\/:batchId\/documents\/:taxDocumentId\/select/);
assert.match(routes, /batches\/:batchId\/documents\/:taxDocumentId\/remove/);
assert.match(routes, /batches\/:batchId\/file/);
assert.match(rootRoutes, /input-documents\/filing/);

console.log('input tax filing HTTP contract evidence: PASS');
