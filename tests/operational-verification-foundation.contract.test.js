'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const service = read('src/modules/system/operational-verification/operationalVerificationService.js');
const routes = read('src/modules/system/operational-verification/operationalVerificationRoutes.js');
const server = read('server.js');

for (const token of [
  "SELECT 1 AS ready",
  "to_regclass('\"ProductReservation\"')",
  "column_name = 'stockReleasedAt'",
  "column_name = 'version'",
  "to_regclass('\"ProductReservationLifecycleCommand\"')",
  "to_regclass('\"ProductReservationLifecycleEvent\"')",
  'Merchant reservation projection readiness',
  'return createCheck(key, label, CHECK_STATUS.READY, details)',
]) {
  assert.ok(service.includes(token), `Missing verification authority: ${token}`);
}

for (const forbidden of [
  '$executeRaw',
  'INSERT INTO',
  'UPDATE "',
  'DELETE FROM',
  'DROP TABLE',
  'ALTER TABLE',
  'prisma migrate',
]) {
  assert.ok(!service.includes(forbidden), `Operational verification must remain read-only: ${forbidden}`);
}

assert.ok(routes.includes('router.use(verifyToken, requireAdministrator)'));
assert.ok(routes.includes("['ADMIN', 'SUPERADMIN']"));
assert.ok(routes.includes("router.get('/', async"));
assert.ok(routes.includes("data.status === 'FAILED' ? 503 : 200"));
assert.ok(server.includes("app.use('/api/operational-verification', operationalVerificationRoutes)"));

for (const forbidden of ['password', 'token', 'DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET']) {
  assert.ok(!service.includes(forbidden), `Verification response must not expose sensitive authority: ${forbidden}`);
}

console.log('Operational Verification Foundation contract: PASS');
