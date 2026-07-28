'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/sales/reservation/store-capability/partnerStoreCapabilityRepository.js');
const service = read('src/modules/sales/reservation/store-capability/partnerStoreCapabilityService.js');
const controller = read('src/modules/sales/reservation/store-capability/partnerStoreCapabilityController.js');
const saleRoutes = read('src/modules/sales/routes/saleRoutes.js');
const publicRepository = read('src/modules/sales/storefront/public/publicStorePolicyRepository.js');
const publicService = read('src/modules/sales/storefront/public/publicStorePolicyService.js');
const publicRoutes = read('src/modules/sales/storefront/public/publicStorePolicyRoutes.js');
const server = read('server.js');

assert.match(controller, /req\.user\?\.branchId/);
assert.doesNotMatch(controller, /req\.body\?\.branchId/);
assert.match(saleRoutes, /router\.use\(verifyToken\)/);
assert.match(saleRoutes, /router\.get\('\/store-capability'/);
assert.match(saleRoutes, /router\.put\('\/store-capability'/);

assert.match(repository, /FOR UPDATE/);
assert.match(repository, /ON CONFLICT \("branchId"\) DO UPDATE/);
assert.match(repository, /DELETE FROM "PartnerStoreServiceArea"/);
assert.match(repository, /"capabilityId"/);
assert.match(repository, /"StoreServiceAreaMode"/);
assert.match(repository, /"StoreServiceAreaType"/);

assert.match(service, /At least one fulfillment method must be enabled/);
assert.match(service, /ADMIN_AREAS requires at least one service area/);
assert.match(service, /DISTANCE mode requires maxDeliveryDistanceKm greater than zero/);
assert.match(service, /Enabled storefront requires storefrontSlug/);
assert.match(service, /lowercase letters, numbers, and hyphens/);

assert.match(publicRepository, /WHERE capability\."storefrontEnabled" = TRUE/);
assert.match(publicRepository, /capability\."storefrontSlug"/);
assert.doesNotMatch(publicRepository, /branchId:/);
assert.doesNotMatch(publicRepository, /capabilityId:/);
assert.match(publicService, /STOREFRONT_SLUG_INVALID/);
assert.match(publicService, /STOREFRONT_NOT_FOUND/);
assert.match(publicRoutes, /router\.get\('\/:slug'/);

const publicMount = server.indexOf("app.use('/api/sales/storefronts', publicStorePolicyRoutes)");
const salesMount = server.indexOf("app.use('/api/sales', saleRoutes)");
assert.ok(publicMount >= 0, 'public storefront mount is required');
assert.ok(salesMount >= 0, 'authenticated sales mount is required');
assert.ok(publicMount < salesMount, 'public storefront route must mount before authenticated sales routes');

console.log('partner store capability mainline runtime contract: PASS');
