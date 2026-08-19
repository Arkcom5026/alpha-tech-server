'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');
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

assert.match(resolver, /findByCode/);
assert.match(resolver, /purpose\.isSystem !== true/);
assert.match(resolver, /purpose\.lifecycleState !== 'ACTIVE'/);
assert.match(resolver, /purpose\.metadata\?\.printEligible !== true/);

assert.match(catalog, /code: 'DELIVERY_NOTE'/);
assert.match(catalog, /displayName: 'ใบส่งสินค้า'/);
assert.match(catalog, /printEligible: true/);

assert.match(controller, /req\.user\?\.branchId/);
assert.match(controller, /projectSaleDeliveryNote/);
assert.match(routes, /getSaleDeliveryNote/);
assert.match(routes, /\/:id\/delivery-note/);

console.log('Sale delivery-note print projection contract: PASS');
