'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const history = read('src/modules/finance/combined-billing/unifiedDocumentHistoryController.js');
const routes = read('src/modules/finance/combined-billing/routes/combinedBillingRoutes.js');
const workspace = read('src/modules/finance/combined-billing/documentWorkspaceService.js');
const taxIssue = read('src/modules/tax/documents/issue/issueOutputTaxDocumentService.js');
const schema = read('prisma/commerce/sales.prisma');

assert.match(routes, /router\.get\('\/unified-document-history',\s*unifiedDocumentHistory\)/, 'combined billing must expose the unified history bridge');
assert.match(history, /const branchId = positive\(req\.user\?\.branchId\)/, 'unified history must derive tenant authority from the authenticated branch');
assert.match(history, /BRANCH_CONTEXT_REQUIRED/, 'unified history must reject requests without branch authority');
assert.match(history, /new Set\(\['BILL', 'DELIVERY_NOTE'\]\)/, 'history bridge must distinguish Bill and Delivery Note purposes');
assert.match(history, /saleRows = saleRows\.filter\(\(row\) => row\.isFullyPaid\)/, 'Bill history must preserve the legacy onlyPaid=fully-paid Sale semantics');

assert.match(history, /prisma\.consolidatedDeliveryLine\.findMany/, 'Delivery Note reprint eligibility must consult consolidated source-line authority');
assert.match(history, /status:\s*'DOCUMENTED'/, 'documented source lines must leave the original active print lifecycle');
assert.match(history, /combinedBilling:\s*\{\s*is:\s*\{\s*status:\s*\{\s*not:\s*'CANCELLED'/s, 'cancelled consolidations must not suppress source Delivery Notes');
assert.match(history, /id:\s*\{\s*notIn:\s*consumedSaleIds\s*\}/, 'a source Sale with any documented line must be excluded from active Delivery Note history');

assert.match(history, /documentSourceType:\s*SALE_SOURCE_TYPE/, 'normal Sale rows must preserve SALE source identity');
assert.match(history, /documentSourceType:\s*CONSOLIDATED_SOURCE_TYPE/, 'consolidated rows must expose consolidated source identity');
assert.match(history, /prisma\.combinedBillingDocument\.findMany/, 'unified history must reuse existing CombinedBillingDocument persistence');
assert.match(history, /documentLines:\s*\{\s*some:\s*\{\s*status:\s*'DOCUMENTED'/, 'only persisted consolidated document lines may enter the unified lifecycle');

assert.match(workspace, /sourceType:\s*'CONSOLIDATED_DELIVERY'/, 'document workspace must retain its existing consolidated tax source contract');
assert.match(taxIssue, /CONSOLIDATED_DELIVERY/, 'tax issuance authority must already support consolidated Delivery sources');
assert.match(taxIssue, /branchId/, 'tax issuance must remain branch-scoped');

assert.match(schema, /model CombinedBillingDocument/, 'existing CombinedBillingDocument persistence must remain authoritative');
assert.match(schema, /model ConsolidatedDeliveryLine/, 'existing source-line persistence must remain authoritative');
assert.match(schema, /@@unique\(\[branchId, sourceLineType, sourceLineId\]\)/, 'source lines must retain duplicate-document protection');

console.log('Unified Combined Billing Document Lifecycle Server Contract: PASS');
