'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const issueService = read('src/modules/tax/documents/issue/issueOutputTaxDocumentService.js');
const repository = read('src/modules/tax/documents/repository/taxDocumentRepository.js');
const controller = read('src/modules/tax/http/taxIntakeController.js');
const routes = read('src/modules/tax/http/taxIntakeRoutes.js');
const schema = read('prisma/schema.prisma');

assert.match(issueService, /forUpdate: true/);
assert.match(issueService, /FOR UPDATE/);
assert.match(issueService, /TAX_ISSUER_PROFILE_NOT_ACTIVE/);
assert.match(issueService, /TAX_DOCUMENT_ALREADY_ISSUED/);
assert.match(issueService, /TAX_OUTPUT_RECIPIENT_IDENTITY_INCOMPLETE/);
assert.match(issueService, /assertSaleTaxDocumentEligibility/);
assert.match(issueService, /nextShortTaxInvoiceNumber/);
assert.match(issueService, /nextFullTaxInvoiceNumber/);
assert.match(issueService, /issuedDocumentNumber/);
assert.match(repository, /findByIdForUpdate/);
assert.match(repository, /LIMIT 1 FOR UPDATE/);
assert.match(repository, /issuerProfileId/);
assert.match(repository, /issuerSnapshot/);
assert.match(repository, /issuedSequence/);
assert.match(controller, /issueOutputTaxDocument/);
assert.match(routes, /documents\/:taxDocumentId\/issue/);
assert.match(schema, /taxInvoiceKind\s+TaxInvoiceKind\?/);
assert.match(schema, /issuerSnapshot\s+Json\?/);
assert.match(schema, /issuedDocumentNumber\s+String\?/);

console.log('Output tax atomic issuance contract: PASS');
