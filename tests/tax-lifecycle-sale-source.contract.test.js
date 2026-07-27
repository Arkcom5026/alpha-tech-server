'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const lifecycle = require('../src/modules/tax/documents/lifecycle/taxDocumentLifecycle');
const tax = require('../src/modules/tax');

assert.strictEqual(typeof tax.documents.transition, 'function');
assert.strictEqual(typeof tax.intake.registerSaleCandidate, 'function');

const allowed = lifecycle.assertTaxDocumentTransition({
  currentStatus: 'DRAFT',
  targetStatus: 'REGISTERED',
});
assert.strictEqual(allowed.replayed, false);

const replay = lifecycle.assertTaxDocumentTransition({
  currentStatus: 'REGISTERED',
  targetStatus: 'REGISTERED',
});
assert.strictEqual(replay.replayed, true);

assert.throws(
  () => lifecycle.assertTaxDocumentTransition({ currentStatus: 'DRAFT', targetStatus: 'APPROVED' }),
  (error) => error.code === 'TAX_DOCUMENT_TRANSITION_FORBIDDEN',
);

const routes = read('src/modules/tax/http/taxIntakeRoutes.js');
assert.match(routes, /register-sale\/:saleId/);
assert.match(routes, /documents\/:taxDocumentId\/transition/);

const saleAdapter = read('src/modules/tax/sources/sale/registerSaleTaxCandidateService.js');
assert.match(saleAdapter, /sourceType:\s*'SALE'/);
assert.match(saleAdapter, /TAX_SOURCE_SALE_NOT_READY/);
assert.match(saleAdapter, /currency:\s*'THB'/);

const transitionService = read('src/modules/tax/documents/lifecycle/transitionTaxDocumentService.js');
assert.match(transitionService, /findByIdForUpdate/);
assert.match(transitionService, /TAX_DOCUMENT_LIFECYCLE_CONFLICT/);
assert.match(transitionService, /appendLifecycleEvent/);

console.log('tax lifecycle and sale source contract: PASS');
