'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const controller = read('src/modules/finance/combined-billing/presentation/getCombinedBillingPresentationController.js');
const routes = read('src/modules/finance/combined-billing/routes/combinedBillingRoutes.js');

assert.match(routes, /router\.get\('\/:id\/presentation', getCombinedBillingPresentation\)/);
assert.match(routes, /router\.get\('\/:id', getCombinedBillingById\)/);
assert.match(controller, /const branchId = positiveInt\(req\.user\?\.branchId\)/);
assert.match(controller, /where:\s*\{ id: documentId, branchId \}/);
assert.match(controller, /documentHeaderConfig:\s*true/);
assert.match(controller, /getOrCreatePresentationSnapshot/);
assert.match(controller, /sourceType:\s*'COMBINED_BILLING'/);
assert.match(controller, /documentPurpose:\s*'COMBINED_BILLING'/);
assert.match(controller, /rendererFamily:\s*'A4'/);
assert.match(controller, /presentationSnapshot:\s*record\.snapshot/);

console.log('combined-billing-document-presentation-wave3.contract.test.js: PASS');
