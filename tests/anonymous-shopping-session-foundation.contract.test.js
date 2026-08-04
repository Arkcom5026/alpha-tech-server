'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const assertIncludes = (source, value, message) => {
  if (!source.includes(value)) throw new Error(message || `Expected source to include: ${value}`);
};
const assertExcludes = (source, value, message) => {
  if (source.includes(value)) throw new Error(message || `Expected source to exclude: ${value}`);
};

const migration = read('prisma/migrations/20260729013000_anonymous_shopping_session_foundation/migration.sql');
const repository = read('src/modules/sales/storefront/session/anonymousShoppingSessionRepository.js');
const service = read('src/modules/sales/storefront/session/anonymousShoppingSessionService.js');
const controller = read('src/modules/sales/storefront/session/anonymousShoppingSessionController.js');
const routes = read('src/modules/sales/storefront/session/anonymousShoppingSessionRoutes.js');
const server = read('server.js');

assertIncludes(migration, 'AnonymousShoppingSessionStatus', 'Session lifecycle enum is required');
assertIncludes(migration, 'publicTokenHash', 'Only a token hash may be persisted');
assertExcludes(migration, 'customerId', 'Anonymous session must not require customer identity');
assertExcludes(migration, 'employeeId', 'Anonymous session must not require employee identity');
assertExcludes(migration, 'unitPrice', 'Session items must not own price snapshots');
assertExcludes(migration, 'reservedQuantity', 'Session items must not reserve inventory');
assertIncludes(migration, 'UNIQUE ("sessionId", "productId")', 'One item row per product is required');
assertIncludes(migration, 'CHECK ("quantity" > 0)', 'Quantity must be positive');

assertIncludes(repository, "createHash('sha256')", 'Public token must be hashed before persistence lookup');
assertIncludes(repository, 'PartnerStoreCapability', 'Session must resolve an enabled storefront');
assertIncludes(repository, 'BranchPrice', 'Item mutation must check public price eligibility');
assertIncludes(repository, 'priceOnline', 'Item mutation must use the online publication boundary');
assertIncludes(repository, 'effectiveDate', 'Item mutation must respect publication effective time');
assertIncludes(repository, 'expiredDate', 'Item mutation must respect publication expiry time');
assertIncludes(repository, 'CURRENT_TIMESTAMP', 'Publication window must be evaluated by database time authority');
assertExcludes(repository, 'branchId: Number(row.branchId)', 'Public session projection must not expose branchId');
assertExcludes(repository, 'id: Number(row.id)', 'Public session projection must not expose internal session id');
assertExcludes(repository, 'ProductReservation', 'Session mutation must not create a ProductReservation');
assertExcludes(repository, 'StockMovement', 'Session mutation must not create stock movement');
assertExcludes(repository, 'reserved', 'Session mutation must not reserve stock');

assertIncludes(service, 'SESSION_TTL_HOURS = 72', 'Session expiry policy must be explicit');
assertIncludes(service, 'MAX_ITEM_QUANTITY = 99', 'Quantity abuse limit must be explicit');
assertIncludes(service, 'crypto.randomBytes(32)', 'Session token must use cryptographic randomness');
assertIncludes(service, 'ANONYMOUS_SESSION_NOT_FOUND', 'Unknown and expired session behavior must be explicit');

assertIncludes(controller, "X-Anonymous-Session-Token", 'Transport contract must expose the anonymous token header');
assertIncludes(routes, "router.post('/', createController)", 'Create route is required');
assertIncludes(routes, "router.put('/items/:productId'", 'Item upsert route is required');
assertIncludes(routes, "router.delete('/items/:productId'", 'Item removal route is required');
assertIncludes(routes, "router.delete('/', abandonController)", 'Abandon route is required');
assertExcludes(routes, 'verifyToken', 'Anonymous shopping routes must remain public');

const publicMount = "app.use('/api/sales/storefronts/:slug/session', anonymousShoppingSessionRoutes);";
const authenticatedMount = "app.use('/api/sales', saleRoutes);";
assertIncludes(server, publicMount, 'Anonymous session routes must be mounted');
if (server.indexOf(publicMount) > server.indexOf(authenticatedMount)) {
  throw new Error('Anonymous session route must be mounted before authenticated sales routes');
}
assertIncludes(server, "'X-Anonymous-Session-Token'", 'CORS must allow and expose anonymous session token');

console.log('Anonymous Shopping Session Foundation contract: PASS');
