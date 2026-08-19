'use strict';

const assert = require('assert');
const controller = require('../src/modules/tax/http/taxIntakeController');
const routes = require('../src/modules/tax/http/taxIntakeRoutes');
const tax = require('../src/modules/tax');

assert.strictEqual(typeof controller.registerCandidate, 'function');
assert.strictEqual(typeof controller.registerSaleCandidate, 'function');
assert.strictEqual(typeof controller.listCandidates, 'function');
assert.strictEqual(typeof controller.listDocuments, 'function');
assert.strictEqual(typeof controller.getDocumentDetail, 'function');
assert.strictEqual(typeof controller.getPrintableOutputTaxDocument, 'function');
assert.strictEqual(typeof controller.issueOutputTaxDocument, 'function');
assert.strictEqual(typeof controller.issueOutputTaxCreditNote, 'function');
assert.strictEqual(typeof controller.issueOutputTaxCreditNoteForSaleReturn, 'function');
assert.strictEqual(typeof controller.transitionDocument, 'function');

const routeContracts = routes.stack
  .filter((layer) => layer.route)
  .map((layer) => ({
    path: layer.route.path,
    methods: Object.keys(layer.route.methods).sort(),
  }));

assert.deepStrictEqual(routeContracts, [
  { path: '/candidates/register', methods: ['post'] },
  { path: '/candidates/register-sale/:saleId', methods: ['post'] },
  { path: '/candidates', methods: ['get'] },
  { path: '/documents', methods: ['get'] },
  { path: '/documents/:taxDocumentId', methods: ['get'] },
  { path: '/documents/:taxDocumentId/printable', methods: ['get'] },
  { path: '/documents/:taxDocumentId/presentation', methods: ['get'] },
  { path: '/documents/:taxDocumentId/issue', methods: ['post'] },
  { path: '/documents/:taxDocumentId/credit-note', methods: ['post'] },
  { path: '/credit-notes/from-sale-return/:saleReturnId', methods: ['post'] },
  { path: '/documents/:taxDocumentId/transition', methods: ['post'] },
]);

assert.strictEqual(tax.intake.routes, routes);
assert.strictEqual(typeof tax.intake.service.registerTaxCandidate, 'function');
assert.strictEqual(typeof tax.intake.service.registerSaleTaxCandidate, 'function');
assert.strictEqual(typeof tax.intake.service.listCandidates, 'function');
assert.strictEqual(typeof tax.intake.service.listDocuments, 'function');
assert.strictEqual(typeof tax.intake.service.getDocumentDetail, 'function');
assert.strictEqual(typeof tax.intake.service.projectOutputTaxPrintableDocument, 'function');
assert.strictEqual(typeof tax.intake.service.issueOutputTaxDocument, 'function');
assert.strictEqual(typeof tax.intake.service.issueOutputTaxCreditNote, 'function');
assert.strictEqual(typeof tax.intake.service.issueOutputTaxCreditNoteForSaleReturn, 'function');
assert.strictEqual(typeof tax.intake.service.transitionTaxDocument, 'function');

console.log('Tax intake HTTP contract: PASS');
