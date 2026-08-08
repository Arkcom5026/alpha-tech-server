'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/sales/storefront/public/publicStorefrontRepository.js');
const service = read('src/modules/sales/storefront/public/publicStorefrontService.js');
const routes = read('src/modules/sales/storefront/public/publicStorefrontRoutes.js');
const server = require('../scripts/read-server-composition-source').readServerCompositionSource(root);

const assertIncludes = (source, value, label) => {
  if (!source.includes(value)) throw new Error(`${label} missing: ${value}`);
};

const assertExcludes = (source, value, label) => {
  if (source.includes(value)) throw new Error(`${label} must not expose: ${value}`);
};

assertIncludes(repository, 'capability."storefrontEnabled" = TRUE', 'published storefront policy');
assertIncludes(repository, 'price."priceOnline" IS NOT NULL', 'online price policy');
assertIncludes(repository, 'price."priceOnline" > 0', 'positive online price policy');
assertIncludes(repository, 'price."effectiveDate" IS NULL', 'effective price policy');
assertIncludes(repository, 'price."expiredDate" IS NULL', 'expiry price policy');
assertIncludes(repository, 'brand."id" IS NULL OR brand."active" = TRUE', 'optional active brand policy');
assertIncludes(repository, 'product_type."id" IS NULL OR', 'optional taxonomy policy');
assertIncludes(repository, 'ILIKE', 'case-insensitive search');
assertIncludes(repository, 'LIMIT ${pageSize} OFFSET ${offset}', 'pagination query policy');
assertIncludes(repository, 'GREATEST(COALESCE(balance."quantity", 0) - COALESCE(balance."reserved", 0), 0)', 'availability policy');
assertIncludes(repository, "currency: 'THB'", 'public monetary contract');

assertIncludes(service, 'PUBLIC_PRODUCT_NOT_FOUND', 'product failure contract');
assertIncludes(service, 'pageSize = normalizePositiveInt', 'pagination validation contract');
assertIncludes(service, 'branchId: storefront.branchId', 'store-scoped discovery contract');

assertExcludes(repository, 'costPrice', 'public projection');
assertExcludes(repository, 'avgCost', 'public projection');
assertExcludes(repository, 'lastReceivedCost', 'public projection');
assertExcludes(repository, 'Supplier', 'public projection');
assertExcludes(repository, 'margin', 'public projection');

assertIncludes(routes, "router.get('/:slug', getPublicStorefrontController)", 'storefront detail route');
assertIncludes(routes, "router.get('/:slug/products', listPublicStorefrontProductsController)", 'product listing route');
assertIncludes(routes, "router.get('/:slug/products/:productId', getPublicStorefrontProductController)", 'product detail route');
assertIncludes(server, "app.use('/api/sales/storefronts', publicStorefrontRoutes)", 'runtime route mount');

const storefrontIndex = server.indexOf("app.use('/api/sales/storefronts', publicStorefrontRoutes)");
const sessionIndex = server.indexOf("app.use('/api/sales/storefronts/:slug/session', anonymousShoppingSessionRoutes)");
const salesIndex = server.indexOf("app.use('/api/sales', saleRoutes)");
if (!(storefrontIndex >= 0 && storefrontIndex < sessionIndex && sessionIndex < salesIndex)) {
  throw new Error('public storefront/session routes must be mounted before authenticated sales routes');
}

console.log('Public Storefront Discovery repository contract: PASS');
