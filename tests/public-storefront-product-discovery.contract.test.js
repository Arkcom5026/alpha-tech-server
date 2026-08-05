'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const server = read('server.js');
const routes = read('src/modules/sales/storefront/public/publicStorefrontRoutes.js');
const controller = read('src/modules/sales/storefront/public/publicStorefrontController.js');
const service = read('src/modules/sales/storefront/public/publicStorefrontService.js');
const repository = read('src/modules/sales/storefront/public/publicStorefrontRepository.js');
const packageJson = JSON.parse(read('package.json'));

assert.equal(
  packageJson.scripts['test:public-storefront'],
  'node tests/public-storefront-product-discovery.contract.test.js'
);

assert.match(server, /require\('\.\/src\/modules\/sales\/storefront\/public\/publicStorefrontRoutes'\)/);
assert.match(server, /app\.use\('\/api\/sales\/storefronts', publicStorefrontRoutes\)/);
assert.match(server, /app\.use\('\/api\/sales\/storefronts\/:slug\/session', anonymousShoppingSessionRoutes\)/);
assert.match(server, /app\.use\('\/api\/sales\/storefronts\/:slug\/identity', commerceIdentityRoutes\)/);
assert.match(server, /app\.use\('\/api\/sales\/storefronts\/:slug\/commitment', productReservationCommitmentRoutes\)/);

assert.match(routes, /router\.get\('\/:slug', getPublicStorefrontController\)/);
assert.doesNotMatch(routes, /verifyToken|authenticate|requireAuth|router\.use/);
assert.match(controller, /req\.params\?\.slug/);
assert.match(service, /STOREFRONT_SLUG_INVALID/);
assert.match(service, /STOREFRONT_NOT_FOUND/);
assert.match(service, /const \{ branchId: _branchId, \.\.\.publicStorefront \} = storefront/);
assert.match(repository, /FROM "PartnerStoreCapability" capability/);
assert.match(repository, /capability\."storefrontEnabled" = TRUE/);
assert.match(repository, /capability\."storefrontSlug" = \$\{slug\}/);
assert.match(repository, /JOIN "StoreExperienceProfile" experience/);
assert.match(repository, /experience\."status" = 'PUBLISHED'/);
assert.match(repository, /themePreset: store\.themePreset/);
assert.match(repository, /sectionConfiguration: store\.sectionConfiguration \|\| null/);
assert.match(repository, /FROM "PartnerStoreServiceArea" area/);
assert.match(repository, /FROM "BranchPrice" price/);
assert.match(repository, /JOIN "Product" product/);
assert.match(repository, /LEFT JOIN "StockBalance" balance/);
assert.match(repository, /FROM "ProductImage" product_image/);
assert.match(repository, /price\."isActive" = TRUE/);
assert.match(repository, /price\."priceOnline" > 0/);
assert.match(repository, /product\."active" = TRUE/);
assert.match(repository, /'AVAILABLE' : 'OUT_OF_STOCK'/);

for (const forbidden of [
  'costPrice:',
  'averageCost:',
  'supplier',
  'employee',
]) {
  assert.doesNotMatch(repository, new RegExp(forbidden, 'i'));
}

assert.doesNotMatch(repository, /create\(|update\(|upsert\(|delete\(|deleteMany\(|createMany\(/);
assert.doesNotMatch(repository, /OrderOnline|Cart|ProductReservation/);

console.log('public storefront product discovery repository contract: PASS');
