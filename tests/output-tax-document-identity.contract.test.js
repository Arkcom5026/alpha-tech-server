'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const {
  mapCandidateToTaxDocumentDraft,
} = require('../src/modules/tax/candidates/mapping/mapCandidateToTaxDocument');

const candidate = {
  id: 9,
  branchId: 7,
  sourceType: 'SALE',
  sourceId: '101',
  sourceDocumentNo: 'SL-07-0010',
  registrationKey: '7:SALE:101',
  occurredAt: new Date('2026-08-03T00:00:00.000Z'),
  snapshot: {},
};

const mapped = mapCandidateToTaxDocumentDraft({
  candidate,
  issuerTaxId: '0-1234-56789-01-2',
  counterpartyTaxId: '9-8765-43210-98-7',
});

assert.strictEqual(mapped.documentType, 'OUTPUT_TAX_INVOICE');
assert.strictEqual(mapped.counterpartyTaxId, '9876543210987');
assert.strictEqual(mapped.issuerTaxId, '0123456789012');
assert.strictEqual(mapped.identityKey, '7:OUTPUT_TAX_INVOICE:0123456789012:SL-07-0010');

const issuerUnknown = mapCandidateToTaxDocumentDraft({
  candidate,
  counterpartyTaxId: '9-8765-43210-98-7',
});

assert.strictEqual(issuerUnknown.counterpartyTaxId, '9876543210987');
assert.strictEqual(issuerUnknown.identityKey, '7:OUTPUT_TAX_INVOICE:-:SL-07-0010');

const registrationService = read('src/modules/tax/intake/registerTaxCandidateService.js');
assert.match(registrationService, /issuerTaxId:\s*snapshot\.issuerTaxId \|\| null/);
assert.match(registrationService, /counterpartyTaxId:\s*snapshot\.counterpartyTaxId \|\| null/);
assert.match(registrationService, /counterpartyTaxId:\s*mapped\.counterpartyTaxId/);
assert.doesNotMatch(registrationService, /issuerTaxId:\s*snapshot\.issuerTaxId \|\| snapshot\.counterpartyTaxId/);

const publicationService = read('src/modules/sales/completion/services/publishSaleTaxCandidateService.js');
assert.match(publicationService, /SALE_PAYMENT_NOT_TAX_ELIGIBLE/);
assert.match(publicationService, /status:\s*'SKIPPED'/);

console.log('Output tax document identity and payment-skip contract: PASS');
