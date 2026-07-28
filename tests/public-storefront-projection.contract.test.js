'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/sales/storefront/public/publicStorefrontRepository.js');
const service = read('src/modules/sales/storefront/public/publicStorefrontService.js');
const controller = read('src/modules/sales/storefront/public/publicStorefrontController.js');
const routes = read('src/modules/sales/storefront/public/publicStorefrontRoutes.js');
const saleRoutes = read('src/modules/sales/routes/saleRoutes.js');

assert.match(repository, /storefrontEnabled" = TRUE/);
assert.match(repository, /storefrontSlug" = \$\{slug\}/);
assert.match(repository, /JOIN "Branch"/);
assert.match(repository, /PartnerStoreServiceArea/);
assert.doesNotMatch(repository, /branchId:/);
assert.doesNotMatch(repository, /capabilityId:/);
assert.doesNotMatch(repository, /createdAt:/);
assert.doesNotMatch(repository, /updatedAt:/);
assert.match(service, /STOREFRONT_SLUG_INVALID/);
assert.match(service, /STOREFRONT_NOT_FOUND/);
assert.match(controller, /getPublicStorefront/);
assert.match(routes, /router\.get\('\/:slug'/);
assert.ok(
  saleRoutes.indexOf("router.use('/storefronts', publicStorefrontRoutes)") < saleRoutes.indexOf('router.use(verifyToken)'),
  'public storefront route must be mounted before authentication middleware'
);

console.log('public storefront projection contract: PASS');
