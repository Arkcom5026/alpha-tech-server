'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const architecture = read('docs/workflows/delivery-note-lifecycle-wave0-contract-map.md');
const issuance = read('src/modules/sales/documents/issue/issueSaleDeliveryNoteService.js');
const printProjection = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');
const replacementSchema = read('prisma/commerce/sale-document-preparation.prisma');
const replacementPolicy = read('src/modules/sales/document-replacement/documentReplacementPolicy.js');
const returnAwareReceivable = read('src/modules/sales/shared/creditReceivableAuthority.js');
const settlementEligibility = read('src/modules/customer-money/settlement/delivery-credit/listEligibleDeliveryCreditsService.js');
const manualWorkspace = read('src/modules/finance/combined-billing/documentWorkspaceService.js');
const settlementConsolidation = read('src/modules/finance/combined-billing/create/createSettlementConsolidatedDelivery.js');
const history = read('src/modules/finance/combined-billing/unifiedDocumentHistoryController.js');
const taxIssuance = read('src/modules/tax/documents/issue/issueOutputTaxDocumentService.js');

// Legacy Delivery Note identity remains Sale-backed at Wave 0.
assert.match(issuance, /officialDocumentNumber/);
assert.match(issuance, /const documentNumber = `DN-\$\{sale\.code\}`/);
assert.match(printProjection, /saleId/);
assert.match(printProjection, /documentNumber: sale\.officialDocumentNumber/);

// Existing replacement infrastructure already carries lineage, but it is a
// financially locked presentation/recomposition authority rather than return adjustment.
assert.match(replacementSchema, /model SaleDocumentReplacement/);
assert.match(replacementSchema, /replacesReplacementId/);
assert.match(replacementSchema, /currentKey/);
assert.match(replacementSchema, /financialLock/);
assert.match(replacementSchema, /supersededAt/);
assert.match(replacementPolicy, /FORBIDDEN_SOURCE_IDENTITY_FIELDS/);
assert.match(replacementPolicy, /DOCUMENT_REPLACEMENT_IN_BUDGET_TOTAL_CHANGED/);
assert.match(replacementPolicy, /Replacement total must reconcile to locked source total/);

// Return-aware commercial authority already exists and must be reused.
assert.match(returnAwareReceivable, /calculateReturnedReceivableAmount/);
assert.match(returnAwareReceivable, /calculateNetReceivableTotal/);
assert.match(settlementEligibility, /returnedQuantity/);
assert.match(settlementEligibility, /billableAmount/);
assert.match(settlementEligibility, /calculateNetReceivableTotal/);

// Archaeology records two consolidation paths. The manual path is currently
// original-Sale-line based, while settlement auto-consolidation consumes prepared snapshots.
assert.match(manualWorkspace, /const lineProjection = \(sale, type, item, settledAmount\)/);
assert.match(manualWorkspace, /const quantity = type === 'STOCK' \? 1 : money\(item\.quantity\)/);
assert.doesNotMatch(manualWorkspace, /returnedQuantity/);
assert.match(settlementConsolidation, /prepared/);
assert.match(settlementConsolidation, /item\.snapshot\.quantity/);
assert.match(settlementConsolidation, /item\.snapshot\.lineAmount/);

// History already exposes return-aware financial projection but suppresses active
// consolidated source Sales instead of representing their lifecycle as historical rows.
assert.match(history, /calculateReturnedReceivableAmount/);
assert.match(history, /calculateNetReceivableTotal/);
assert.match(history, /consumedSourceExclusion/);

// Tax authority already supports source migration and prevents Sale issuance after consolidation.
assert.match(taxIssuance, /candidate\?\.sourceType === 'CONSOLIDATED_DELIVERY'/);
assert.match(taxIssuance, /TAX_SOURCE_SALE_ALREADY_CONSOLIDATED/);
assert.match(taxIssuance, /DOCUMENT_PREPARATION/);

// The Wave 0 document must preserve the core architectural distinction that avoids
// weakening the existing replacement engine to fit return-adjusted documents.
assert.match(architecture, /financial-lock replacement/i);
assert.match(architecture, /return-adjusted Delivery Note revision/i);
assert.match(architecture, /two consolidation paths/i);
assert.match(architecture, /additive and non-destructive/i);
assert.match(architecture, /no runtime\/schema mutation/i);

console.log('Delivery Note Lifecycle Wave 0 archaeology contract: PASS');
