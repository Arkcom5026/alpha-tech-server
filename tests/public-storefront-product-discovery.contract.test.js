'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/sales/storefront/public/publicStorefrontRepository.js');
const service = read('src/modules/sales/storefront/public/publicStorefrontService.js');
const controller = read('src/modules/sales/storefront/public/publicStorefrontController.js');
const routes = read('src/modules/sales/storefront/public/publicStorefrontRoutes.js');
const server = read('server.js');

assert.match(repository, /FROM "PartnerStoreCapability" capability/);
assert.match(repository, /JOIN "Branch" branch/);
assert.match(repository, /JOIN "BranchPrice" price/);
assert.match(repository, /JOIN "Product" product/);
assert.match(repository, /LEFT JOIN "StockBalance" balance/);
assert.match(repository, /LEFT JOIN LATERAL/);
assert.match(repository, /FROM "ProductImage" product_image/);
assert.match(repository, /price\."priceOnline" IS NOT NULL/);
assert.match(repository, /price\."priceOnline" > 0/);
assert.match(repository, /product\."active" = TRUE/);
assert.match(repository, /GREATEST\(COALESCE\(balance\."quantity", 0\) - COALESCE\(balance\."reserved", 0\), 0\)/);
assert.doesNotMatch(repository, /costPrice/);
assert.doesNotMatch(repository, /avgCost/);
assert.doesNotMatch(repository, /availableQuantity:\s*availableQuantity/);
assert.match(repository, /status: availableQuantity > 0 \? 'AVAILABLE' : 'OUT_OF_STOCK'/);
assert.match(service, /STOREFRONT_SLUG_INVALID/);
assert.match(service, /STOREFRONT_NOT_FOUND/);
assert.match(controller, /res\.status\(200\)\.json\(\{ ok: true, data: result \}\)/);
assert.match(routes, /router\.get\('\/:slug', getPublicStorefrontController\)/);
assert.match(server, /app\.use\('\/api\/sales\/storefronts', publicStorefrontRoutes\)/);

console.log('public storefront product discovery contract: PASS');
