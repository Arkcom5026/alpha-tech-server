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
  assert.match(service, /DOCUMENT_WORKSPACE_LINE_ALREADY_DOCUMENTED/);
  assert.match(service, /DOCUMENT_PRICE_ADJUSTMENT_RELEASE/);
  assert.match(service, /customerMoneyBalance\.upsert/);
  assert.doesNotMatch(service, /stockMovement|inventory|stockItem\.update|sale\.update/);
});

test('duplicate source-line submission is a business conflict before Prisma writes', () => {
  const service = read('src/modules/finance/combined-billing/documentWorkspaceService.js');
  const controller = read('src/modules/finance/combined-billing/documentWorkspaceController.js');
  assert.match(service, /consolidatedDeliveryLine\.findFirst/);
  assert.match(controller, /error\?\.code === 'P2002'/);
  assert.match(controller, /status\(409\)/);
});

test('consolidated delivery owns tax authority only when source credit sales have no issued tax invoice', () => {
  const service = read('src/modules/finance/combined-billing/documentWorkspaceService.js');
  const contract = read('src/modules/tax/candidates/contracts/taxCandidateContract.js');
  const issue = read('src/modules/tax/documents/issue/issueOutputTaxDocumentService.js');
  assert.match(service, /officialDocumentNumber: \{ not: null \}/);
  assert.match(service, /isCredit: true/);
  assert.match(service, /DOCUMENT_WORKSPACE_SOURCE_TAX_ALREADY_ISSUED/);
  assert.match(service, /sourceType: 'SALE'/);
  assert.match(service, /status: 'REGISTERED'/);
  assert.match(service, /registerConsolidatedTaxCandidate/);
  assert.match(service, /taxAuthorityMode: 'CONSOLIDATED_TAX_DRAFT'/);
  assert.match(service, /sourceType: 'CONSOLIDATED_DELIVERY'/);
  assert.match(contract, /'CONSOLIDATED_DELIVERY'/);
  assert.match(issue, /candidate\?\.sourceType === 'CONSOLIDATED_DELIVERY'/);
  assert.match(issue, /TAX_SOURCE_SALE_ALREADY_CONSOLIDATED/);
});

test('consolidated delivery has its own printable snapshot without issuing tax', () => {
  const history = read('src/modules/finance/combined-billing/documentHistoryController.js');
  const routes = read('src/modules/finance/combined-billing/routes/combinedBillingRoutes.js');
  assert.match(history, /title: 'ใบส่งของรวม'/);
  assert.match(history, /documentUnitPrice/);
  assert.match(routes, /consolidated-deliveries\/:id\/printable/);
  assert.match(history, /subdistrict: \{ include: \{ district: \{ include: \{ province: true \} \} \} \}/);
});

test('new consolidated tax snapshots preserve the structured customer address', () => {
  const service = read('src/modules/finance/combined-billing/documentWorkspaceService.js');
  assert.match(service, /customer: \{ include: customerInclude \}/);
  assert.match(service, /province: true/);
});
