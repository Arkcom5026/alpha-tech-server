'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/tax/sources/saleReturn/registerSaleReturnTaxCandidateService.js');
const controller = read('src/modules/tax/http/taxIntakeController.js');
const routes = read('src/modules/tax/http/taxIntakeRoutes.js');
const httpService = read('src/modules/tax/http/taxIntakeService.js');

assert.match(service, /where: \{ id: normalizedSaleReturnId, branchId: normalizedBranchId \}/);
assert.match(service, /TAX_SALE_RETURN_DEDUCTED_REFUND_REVIEW_REQUIRED/);
assert.match(service, /TAX_SALE_RETURN_FULL_REFUND_REQUIRED/);
assert.match(service, /status: 'APPROVED'/);
assert.match(service, /sourceType: 'SALE'/);
assert.match(service, /sourceType: 'SALE_RETURN'/);
assert.match(service, /documentType: 'CREDIT_NOTE'/);
assert.match(service, /originalTaxDocumentId/);
assert.match(service, /taxAdjustmentState: 'CREDIT_NOTE_CANDIDATE'/);

assert.match(controller, /registerSaleReturnTaxCandidate/);
assert.match(routes, /\/candidates\/register-sale-return\/:saleReturnId/);
assert.match(httpService, /registerSaleReturnTaxCandidate/);

console.log('Sale Return Output Tax Credit Note candidate contract: PASS');
