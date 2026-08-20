'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const preparationService = read(
  'src', 'modules', 'sales', 'document-preparation', 'documentPreparationService.js',
);
const saleRegistration = read(
  'src', 'modules', 'tax', 'sources', 'sale', 'registerSaleTaxCandidateService.js',
);
const preparationRegistration = read(
  'src', 'modules', 'tax', 'sources', 'document-preparation', 'registerDocumentPreparationTaxCandidatesService.js',
);
const issuance = read(
  'src', 'modules', 'tax', 'documents', 'issue', 'issueOutputTaxDocumentService.js',
);
const outputVat = read(
  'src', 'modules', 'tax', 'outputVat', 'outputVatRecordService.js',
);

assert.match(preparationService, /preparation\.status === 'LOCKED' && preparation\.finalSnapshot/);
assert.match(preparationService, /const snapshotLines = Array\.isArray\(snapshot\.lines\)/);
assert.match(preparationService, /lines: snapshotLines/);
assert.match(preparationService, /snapshot\.totals\?\.inBudgetTotal/);
assert.match(preparationService, /snapshot\.taxProjection/);

assert.match(saleRegistration, /TAX_SOURCE_SALE_PREPARATION_AUTHORITY_ACTIVE/);
assert.match(saleRegistration, /sourceType: 'DOCUMENT_PREPARATION'/);
assert.match(saleRegistration, /sourceId: \{ startsWith: `\$\{preparation\.id\}:` \}/);

assert.match(preparationRegistration, /DOCUMENT_PREPARATION_SOURCE_TAX_ALREADY_ISSUED/);
assert.match(preparationRegistration, /issuedDocumentNumber: \{ not: null \}/);
assert.match(preparationRegistration, /issuerProfileId: \{ not: null \}/);
assert.ok(!/status: 'REGISTERED',[\s\S]{0,120}issuedDocumentNumber/.test(preparationRegistration),
  'issued source tax detection must not depend on one lifecycle status');

assert.match(issuance, /const assertNoPreparationTaxAuthorityForSaleIds/);
assert.match(issuance, /sourceType: 'DOCUMENT_PREPARATION'/);
assert.match(issuance, /TAX_SOURCE_PREPARATION_AUTHORITY_ACTIVE/);
assert.match(issuance, /sourceSaleId: true/);
assert.match(issuance, /source\.documentLines\.map\(\(line\) => line\.sourceSaleId\)/);
assert.match(issuance, /candidate\?\.sourceType === 'CONSOLIDATED_DELIVERY'/);
assert.match(issuance, /candidate\?\.sourceType === 'DOCUMENT_PREPARATION'/);
assert.match(issuance, /TAX_DOCUMENT_PREPARATION_KIND_MISMATCH/);

assert.match(outputVat, /where: \{ taxDocumentId: Number\(document\.id\) \}/);
assert.match(outputVat, /replayKeyFor\(document\)/);
assert.match(outputVat, /totalAmount: document\.totalAmount/);
assert.match(outputVat, /taxAmount: document\.taxAmount/);

for (const forbidden of [
  'prisma.sale.create(',
  'prisma.stockItem.create(',
  'prisma.customerProfile.create(',
]) {
  assert.ok(!preparationRegistration.includes(forbidden), `Preparation tax projection must not create ${forbidden}`);
}

console.log('Sale document preparation Wave 5 hardening contract: PASS');
