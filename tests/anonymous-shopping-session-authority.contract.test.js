'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const migration = read('prisma/migrations/20260729013000_anonymous_shopping_session_foundation/migration.sql');
const schema = read('prisma/anonymous-shopping-session.prisma');
const server = require('../scripts/read-server-composition-source').readServerCompositionSource(root);
const routes = read('src/modules/sales/storefront/session/anonymousShoppingSessionRoutes.js');
const controller = read('src/modules/sales/storefront/session/anonymousShoppingSessionController.js');
const service = read('src/modules/sales/storefront/session/anonymousShoppingSessionService.js');
const repository = read('src/modules/sales/storefront/session/anonymousShoppingSessionRepository.js');
const packageJson = JSON.parse(read('package.json'));

assert.match(migration, /CREATE TYPE "AnonymousShoppingSessionStatus"/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS "AnonymousShoppingSession"/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS "AnonymousShoppingSessionItem"/);
assert.match(migration, /"publicTokenHash" TEXT NOT NULL UNIQUE/);
assert.match(migration, /CHECK \("quantity" > 0\)/);

assert.match(schema, /model AnonymousShoppingSession/);
assert.match(schema, /publicTokenHash\s+String\s+@unique/);
assert.match(schema, /model AnonymousShoppingSessionItem/);
assert.match(schema, /@@unique\(\[sessionId, productId\]\)/);
assert.match(schema, /enum AnonymousShoppingSessionStatus/);

assert.match(server, /app\.use\('\/api\/sales\/storefronts\/:slug\/session', anonymousShoppingSessionRoutes\)/);
assert.match(routes, /router\.post\('\/'/);
assert.match(routes, /router\.get\('\/'/);
assert.match(routes, /router\.put\('\/items\/:productId'/);
assert.match(routes, /router\.delete\('\/items\/:productId'/);
assert.doesNotMatch(routes, /verifyToken|authenticate|requireAuth/);

assert.match(controller, /X-Anonymous-Session-Token/);
assert.match(service, /SESSION_TTL_HOURS = 72/);
assert.match(service, /MAX_ITEM_QUANTITY = 99/);
assert.match(service, /crypto\.randomBytes\(32\)/);
assert.match(service, /branchId: storefront\.branchId/);

assert.match(repository, /createHash\('sha256'\)/);
assert.match(repository, /"publicTokenHash" = \$\{tokenHash\}/);
assert.match(repository, /"branchId" = \$\{branchId\}/);
assert.match(repository, /"status" = 'ACTIVE'/);
assert.match(repository, /"expiresAt" > CURRENT_TIMESTAMP/);
assert.match(repository, /bp\."isActive" = TRUE/);
assert.match(repository, /bp\."effectiveDate"/);
assert.match(repository, /bp\."expiredDate"/);
assert.doesNotMatch(repository, /bp\."active" = TRUE/);
assert.doesNotMatch(repository, /bp\."effectiveAt"/);
assert.doesNotMatch(repository, /bp\."expiresAt"/);

// Anonymous discovery may read branch-scoped availability, but it must never
// reserve inventory or mutate operational stock/order authorities before commitment.
assert.match(repository, /LEFT JOIN "StockBalance"/);
assert.match(repository, /balance\."reserved"/);
assert.doesNotMatch(repository, /(INSERT INTO|UPDATE|DELETE FROM) "StockBalance"/);
assert.doesNotMatch(repository, /(INSERT INTO|UPDATE|DELETE FROM) "ProductReservation"/);
assert.doesNotMatch(repository, /(INSERT INTO|UPDATE|DELETE FROM) "OrderOnline"/);
assert.doesNotMatch(repository, /(INSERT INTO|UPDATE|DELETE FROM) "Cart"/);

assert.equal(packageJson.scripts['test:anonymous-shopping-session'], 'node tests/anonymous-shopping-session-authority.contract.test.js');
console.log('anonymous shopping session authority contract: PASS');
