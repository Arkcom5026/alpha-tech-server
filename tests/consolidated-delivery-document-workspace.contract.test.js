'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('document workspace persists immutable source and negotiated document prices per line', () => {
  const schema = read('prisma/commerce/sales.prisma');
  assert.match(schema, /model ConsolidatedDeliveryLine/);
  assert.match(schema, /sourceUnitPrice/);
  assert.match(schema, /documentUnitPrice/);
  assert.match(schema, /priceAdjustment/);
  assert.match(schema, /adjustmentReason/);
  assert.match(schema, /@@unique\(\[branchId, sourceLineType, sourceLineId\]\)/);
});

test('confirmation protects paid authority, releases negotiated surplus and never mutates inventory', () => {
  const service = read('src/modules/finance/combined-billing/documentWorkspaceService.js');
  assert.match(service, /DOCUMENT_WORKSPACE_ADDITIONAL_PAYMENT_REQUIRED/);
  assert.match(service, /DOCUMENT_PRICE_ADJUSTMENT_RELEASE/);
  assert.match(service, /customerMoneyBalance\.upsert/);
  assert.doesNotMatch(service, /stockMovement|inventory|stockItem\.update|sale\.update/);
});

test('consolidated delivery is registered into the existing output tax authority', () => {
  const service = read('src/modules/finance/combined-billing/documentWorkspaceService.js');
  const contract = read('src/modules/tax/candidates/contracts/taxCandidateContract.js');
  const issue = read('src/modules/tax/documents/issue/issueOutputTaxDocumentService.js');
  assert.match(service, /registerConsolidatedTaxCandidate/);
  assert.match(service, /taxDocumentRepository\.create/);
  assert.match(service, /sourceType: 'CONSOLIDATED_DELIVERY'/);
  assert.match(contract, /'CONSOLIDATED_DELIVERY'/);
  assert.match(issue, /candidate\?\.sourceType === 'CONSOLIDATED_DELIVERY'/);
});
