'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/sales/reservation/store-capability/partnerStoreCapabilityRepository.js');
const service = read('src/modules/sales/reservation/store-capability/partnerStoreCapabilityService.js');
const controller = read('src/modules/sales/reservation/store-capability/partnerStoreCapabilityController.js');
const routes = read('src/modules/sales/reservation/routes/productReservationRoutes.js');

assert.match(repository, /db\.\$transaction/);
assert.match(repository, /FROM "Branch"/);
assert.match(repository, /FOR UPDATE/);
assert.match(repository, /ON CONFLICT \("branchId"\) DO UPDATE/);
assert.match(repository, /DELETE FROM "PartnerStoreServiceArea"/);
assert.match(repository, /INSERT INTO "PartnerStoreServiceArea"/);

assert.match(service, /PARTNER_STORE_FULFILLMENT_REQUIRED/);
assert.match(service, /PARTNER_STORE_FIXED_FEE_REQUIRED/);
assert.match(service, /PARTNER_STORE_SERVICE_AREA_REQUIRED/);
assert.match(service, /PARTNER_STORE_DISTANCE_REQUIRED/);
assert.match(service, /PARTNER_STORE_SLUG_INVALID/);
assert.match(service, /PARTNER_STORE_SERVICE_AREA_DUPLICATE/);

assert.match(controller, /req\.user\?\.branchId/);
assert.match(controller, /req\.user\?\.employeeBranchId/);
assert.match(controller, /req\.user\?\.currentBranchId/);
assert.doesNotMatch(controller, /req\.body\?\.branchId/);
assert.match(controller, /branchId: resolveBranchId\(req\)/);

const storeRouteIndex = routes.indexOf("router.get('/store-capability'");
const detailRouteIndex = routes.indexOf("router.get('/:id'");
assert.ok(storeRouteIndex >= 0 && detailRouteIndex >= 0 && storeRouteIndex < detailRouteIndex);
assert.match(routes, /router\.put\('\/store-capability'/);

console.log('partner store capability runtime contract: PASS');
