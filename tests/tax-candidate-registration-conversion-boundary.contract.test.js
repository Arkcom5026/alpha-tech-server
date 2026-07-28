'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const tax = require('../src/modules/tax');

assert.strictEqual(typeof tax.intake.registerCandidate, 'function');
assert.strictEqual(typeof tax.candidates.convert, 'function');
assert.strictEqual(typeof tax.intake.service.registerTaxCandidate, 'function');
assert.strictEqual(typeof tax.intake.service.convertTaxCandidate, 'function');

const registrationService = read('src/modules/tax/intake/registerTaxCandidateService.js');
assert.match(registrationService, /buildTaxCandidateRegistration/);
assert.match(registrationService, /findByRegistrationKey/);
assert.match(registrationService, /candidateRepository\.create/);
assert.match(registrationService, /document:\s*null/);
assert.doesNotMatch(registrationService, /mapCandidateToTaxDocumentDraft/);
assert.doesNotMatch(registrationService, /documentRepository/);
assert.doesNotMatch(registrationService, /updateMapped/);
assert.doesNotMatch(registrationService, /updateConverted/);
assert.doesNotMatch(registrationService, /appendLifecycleEvent/);

const conversionService = read('src/modules/tax/candidates/conversion/convertTaxCandidateService.js');
assert.match(conversionService, /findByIdForUpdate/);
assert.match(conversionService, /findByCandidateId/);
assert.match(conversionService, /replayed:\s*true/);
assert.match(conversionService, /mapCandidateToTaxDocumentDraft/);
assert.match(conversionService, /findByIdentityKey/);
assert.match(conversionService, /updateMapped/);
assert.match(conversionService, /documentRepository\.create/);
assert.match(conversionService, /appendLifecycleEvent/);
assert.match(conversionService, /updateConverted/);

const saleSource = read('src/modules/tax/sources/sale/registerSaleTaxCandidateService.js');
assert.match(saleSource, /registerTaxCandidate/);
assert.match(saleSource, /convertTaxCandidate/);
assert.match(saleSource, /candidateId:\s*registration\.candidate\.id/);

const purchaseReceiptSource = read('src/modules/tax/sources/purchaseReceipt/registerPurchaseReceiptTaxCandidateService.js');
assert.match(purchaseReceiptSource, /registerTaxCandidate/);
assert.match(purchaseReceiptSource, /convertTaxCandidate/);
assert.match(purchaseReceiptSource, /documentType:\s*'INPUT_TAX_INVOICE'/);
assert.match(purchaseReceiptSource, /candidateId:\s*registration\.candidate\.id/);

console.log('tax candidate registration/conversion boundary contract: PASS');
