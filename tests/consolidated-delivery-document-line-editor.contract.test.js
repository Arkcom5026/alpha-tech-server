'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const schema = read('prisma/consolidated-delivery-presentation.prisma');
const migration = read('prisma/migrations/20260817113000_consolidated_delivery_line_presentation/migration.sql');
const routes = read('src/modules/finance/combined-billing/routes/combinedBillingRoutes.js');
const controller = read('src/modules/finance/combined-billing/documentLinePresentationController.js');
const service = read('src/modules/finance/combined-billing/documentLinePresentationService.js');
const history = read('src/modules/finance/combined-billing/documentHistoryController.js');

assert.match(schema, /model ConsolidatedDeliveryLinePresentation/);
assert.match(schema, /documentPrefix\s+String\?/);
assert.match(schema, /documentDescription\s+String\?/);
assert.match(schema, /documentSuffix\s+String\?/);
assert.match(schema, /@@unique\(\[branchId, consolidatedDeliveryLineId\]\)/);
assert.match(migration, /CREATE TABLE "ConsolidatedDeliveryLinePresentation"/);

assert.match(routes, /router\.put\('\/consolidated-deliveries\/:id\/document-lines', documentLinePresentation\.update\)/);
assert.match(controller, /branchId: req\.user\?\.branchId/);
assert.match(controller, /employeeId: req\.user\?\.employeeId/);

assert.match(service, /combinedBillingDocument\.findFirst/);
assert.match(service, /branchId: normalizedBranchId/);
assert.match(service, /combinedBillingId: normalizedDocumentId/);
assert.match(service, /consolidatedDeliveryLine\.findMany/);
assert.match(service, /consolidatedDeliveryLinePresentation\.upsert/);
assert.match(service, /documentPrefix: line\.documentPrefix/);
assert.match(service, /documentDescription: line\.documentDescription/);
assert.match(service, /documentSuffix: line\.documentSuffix/);
assert.doesNotMatch(service, /documentUnitPrice\s*:/);
assert.doesNotMatch(service, /priceAdjustment\s*:/);
assert.doesNotMatch(service, /documentAmount\s*:/);
assert.doesNotMatch(service, /vatAmount\s*:/);
assert.doesNotMatch(service, /totalAmount\s*:/);

assert.match(history, /consolidatedDeliveryLinePresentation\.findMany/);
assert.match(history, /documentPrefix: presentation\?\.documentPrefix \|\| null/);
assert.match(history, /documentDescription: presentation\?\.documentDescription \|\| null/);
assert.match(history, /documentSuffix: presentation\?\.documentSuffix \|\| null/);

console.log('Consolidated delivery document-line editor authority contract: PASS');
