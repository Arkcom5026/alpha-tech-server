'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');
const currentService = read('src/modules/sales/documents/print/projectCurrentSaleDeliveryNoteService.js');
const resolver = read('src/modules/document-purpose/resolve/resolvePrintDocumentPurposeService.js');
const catalog = read('src/modules/document-purpose/bootstrap/systemDocumentPurposeCatalog.js');
const controller = read('src/modules/sales/documents/controllers/saleDeliveryNoteController.js');
const routes = read('src/modules/sales/routes/saleRoutes.js');

assert.match(service, /where: \{ id: normalizedSaleId, branchId: normalizedBranchId \}/);
assert.match(service, /sale\.status === 'CANCELLED'/);
assert.doesNotMatch(service, /sale\.status !== 'COMPLETED'/);
assert.match(service, /!sale\.officialDocumentNumber/);
assert.match(service, /DELIVERY_NOTE_NOT_ISSUED/);
assert.match(service, /prisma\.consolidatedDeliveryLine\.findFirst/);
assert.match(service, /DELIVERY_NOTE_ALREADY_CONSOLIDATED/);
assert.match(service, /documentNumber: sale\.officialDocumentNumber/);
assert.match(service, /ResolvePrintDocumentPurposeService/);
assert.match(service, /code: 'DELIVERY_NOTE'/);
assert.match(service, /type: purpose\.code/);
assert.match(service, /title: purpose\.displayName/);
assert.doesNotMatch(service, /title:\s*['"]ใบส่งสินค้า['"]/);
assert.match(service, /simpleItems/);
assert.match(service, /documentDescription/);

assert.match(currentService, /projectSaleDeliveryNote/,
  'current Delivery Note read authority must preserve legacy projection as fallback/presentation base');
assert.match(currentService, /loadCurrentDeliveryNoteRevision/,
  'current Delivery Note read authority must resolve persisted revision first');
assert.match(currentService, /source: 'LEGACY_SALE'/,
  'current Delivery Note read authority must expose legacy fallback explicitly');
assert.match(currentService, /source: 'PERSISTED_REVISION'/,
  'current Delivery Note read authority must expose persisted revision authority explicitly');

assert.match(resolver, /findByCode/);
assert.match(resolver, /purpose\.isSystem !== true/);
assert.match(resolver, /purpose\.lifecycleState !== 'ACTIVE'/);
assert.match(resolver, /purpose\.metadata\?\.printEligible !== true/);

assert.match(catalog, /code: 'DELIVERY_NOTE'/);
assert.match(catalog, /displayName: 'ใบส่งสินค้า'/);
assert.match(catalog, /printEligible: true/);

assert.match(controller, /req\.user\?\.branchId/);
assert.match(controller, /projectCurrentSaleDeliveryNote/,
  'controller must route current Delivery Note reads through persisted-revision-aware authority');
assert.match(routes, /getSaleDeliveryNote/);
assert.match(routes, /\/:id\/delivery-note/);

console.log('Sale delivery-note print projection contract: PASS');
