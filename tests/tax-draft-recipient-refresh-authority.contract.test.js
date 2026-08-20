'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildRegisteredAddress,
  resolveSourceSaleId,
} = require('../src/modules/tax/documents/recipient/refreshDraftRecipientService');

assert.strictEqual(resolveSourceSaleId({ candidate: { sourceType: 'SALE', sourceId: '1059' } }), 1059);
assert.strictEqual(resolveSourceSaleId({
  candidate: { sourceType: 'DOCUMENT_PREPARATION', sourceId: '1:IN_BUDGET' },
  snapshot: { sourceSaleId: 1059 },
}), 1059);
assert.strictEqual(resolveSourceSaleId({ candidate: { sourceType: 'CONSOLIDATED_DELIVERY', sourceId: '5' } }), null);

assert.strictEqual(buildRegisteredAddress({
  addressDetail: '123',
  subdistrict: {
    nameTh: 'เจริญผล',
    postcode: '60180',
    district: { nameTh: 'บรรพตพิสัย', province: { nameTh: 'นครสวรรค์' } },
  },
}), '123 ต.เจริญผล อ.บรรพตพิสัย จ.นครสวรรค์ 60180');

const serviceSource = fs.readFileSync(path.join(__dirname, '../src/modules/tax/documents/recipient/refreshDraftRecipientService.js'), 'utf8');
const repositorySource = fs.readFileSync(path.join(__dirname, '../src/modules/tax/documents/repository/taxDocumentRepository.js'), 'utf8');

assert.match(serviceSource, /status !== 'DRAFT'/, 'refresh must guard DRAFT status');
assert.match(serviceSource, /documentType !== 'OUTPUT_TAX_INVOICE'/, 'refresh must guard output tax invoice type');
assert.match(serviceSource, /resolveFinancialCustomerGroup/, 'refresh must resolve legal financial owner authority');
assert.match(serviceSource, /REFRESH_RECIPIENT/, 'refresh must append auditable lifecycle metadata');
assert.match(repositorySource, /refreshDraftRecipientIdentity/, 'repository must expose recipient-only draft mutation');
assert.match(repositorySource, /"status" = 'DRAFT'/, 'repository mutation must be draft-only');
assert.match(repositorySource, /"issuerProfileId" IS NULL/, 'repository mutation must be blocked after issuance');

const forbidden = [
  ['sale', 'update('].join('.'),
  ['saleItem', 'update('].join('.'),
  ['stockItem', 'update('].join('.'),
  ['outputVatRecord', 'update('].join('.'),
  ['taxPeriod', 'update('].join('.'),
  ['saleDocumentPreparation', 'update('].join('.'),
  ['saleDocumentReplacement', 'update('].join('.'),
];
for (const signature of forbidden) {
  assert.ok(!serviceSource.includes(signature), `recipient refresh must not mutate financial/source authority: ${signature}`);
}

console.log('Tax draft recipient refresh authority contract: PASS');
