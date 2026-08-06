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

assert.equal(packageJson.scripts['test:public-storefront'], 'node tests/public-storefront-product-discovery.contract.test.js');
assert.match(server, /publicStorefrontRoutes/);
assert.match(routes, /getPublicStorefrontController/);
assert.doesNotMatch(routes, /verifyToken|authenticate|requireAuth/);
assert.match(controller, /req\.params\?\.slug/);
assert.match(service, /STOREFRONT_SLUG_INVALID/);
assert.match(service, /STOREFRONT_NOT_FOUND/);
assert.match(repository, /FROM "PartnerStoreCapability" capability/);
assert.match(repository, /capability\."storefrontEnabled" = TRUE/);
assert.match(repository, /experience\."status" = 'PUBLISHED'/);
assert.match(repository, /themePreset: store\.publishedThemePreset/);
assert.match(repository, /themeTokens: store\.publishedThemeTokens/);
assert.match(repository, /layoutPreset: store\.publishedLayoutPreset/);
assert.match(repository, /sectionConfiguration: store\.publishedSectionConfiguration/);
assert.match(repository, /FROM "BranchPrice" price/);
assert.match(repository, /JOIN "Product" product/);
assert.match(repository, /LEFT JOIN "StockBalance" balance/);
assert.doesNotMatch(repository, /costPrice:|averageCost:|supplier|employee/i);
assert.doesNotMatch(repository, /OrderOnline|Cart|ProductReservation/);

console.log('public storefront product discovery repository contract: PASS');
