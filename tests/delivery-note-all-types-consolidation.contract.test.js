'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const workspace = read('src/modules/finance/combined-billing/documentWorkspaceService.js');
const taxIssue = read('src/modules/tax/documents/issue/issueOutputTaxDocumentService.js');

// Discovery/confirmation are Delivery Note authority based, not CREDIT-only.
assert.match(workspace, /officialDocumentNumber: \{ not: null \}/);
assert.doesNotMatch(workspace, /isCredit: true, status: \{ not: 'CANCELLED' \}/);
assert.match(workspace, /creditSaleIds/);
assert.match(workspace, /isCashSaleFullyPaid/);
assert.match(workspace, /SALE_PAYMENT/);
assert.match(workspace, /DELIVERY_CREDIT_SETTLEMENT/);

// CASH lines may consolidate only after full payment and at their already-settled price.
assert.match(workspace, /DOCUMENT_WORKSPACE_CASH_SALE_NOT_PAID/);
assert.match(workspace, /DOCUMENT_WORKSPACE_CASH_PRICE_ADJUSTMENT_FORBIDDEN/);
assert.match(workspace, /sale\?\.statusPayment \|\| ''\)\.toUpperCase\(\) === 'PAID'/);
assert.match(workspace, /money\(sale\?\.paidAmount\) \+ 0\.001 >= money\(sale\?\.totalAmount\)/);

// Tax authority must never be duplicated across source Sale and consolidated document.
assert.match(workspace, /issuedSourceTaxCandidates/);
assert.match(workspace, /DOCUMENT_WORKSPACE_MIXED_TAX_AUTHORITY/);
assert.match(workspace, /preserveSourceTax/);
assert.match(workspace, /SOURCE_TAX_PRESERVED/);
assert.match(workspace, /CONSOLIDATED_TAX_DRAFT/);
assert.match(workspace, /preserveSourceTax\s*\?\s*null\s*:\s*await registerConsolidatedTaxCandidate/);
assert.match(taxIssue, /TAX_SOURCE_SALE_ALREADY_CONSOLIDATED/);
assert.match(taxIssue, /consolidatedDeliveryLine\.findFirst/);
assert.match(taxIssue, /combinedBilling: \{ is: \{ status: \{ not: 'CANCELLED' \} \} \}/);

// This agenda only reconciles document/payment/tax authority; inventory remains untouched.
assert.doesNotMatch(workspace, /stockMovement|stockItem\.update|simpleLot\.update|stockBalance\.update/);

console.log('Delivery Note all-types consolidation contract: PASS');
