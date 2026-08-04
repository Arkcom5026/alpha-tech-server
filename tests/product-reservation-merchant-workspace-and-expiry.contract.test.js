'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const routes = read('src/modules/sales/reservations/merchant/productReservationMerchantRoutes.js');
const queries = read('src/modules/sales/reservations/merchant/productReservationMerchantQueryRepository.js');
const expiry = read('src/modules/sales/reservations/expiry/productReservationExpiryRunner.js');
const expiryRoutes = read('src/modules/sales/reservations/expiry/productReservationExpiryRoutes.js');
const server = read('server.js');

for (const token of [
  'router.use(verifyToken, ensureMerchantContext)',
  'req.user.branchId',
  'req.user.employeeId',
  "router.get('/')",
  "router.get('/:reservationId')",
  "router.post('/:reservationId/lifecycle')",
]) assert.ok(routes.includes(token), `Missing merchant route authority: ${token}`);

for (const token of [
  'listMerchantReservations',
  'getMerchantReservationDetail',
  'findExpiredCandidates',
  'ProductReservationLifecycleEvent',
  'ProductReservationLifecycleCommand',
  'reservation."branchId" = ${branchId}',
  'reservation."status"::text IN',
]) assert.ok(queries.includes(token), `Missing projection/query authority: ${token}`);

assert.ok(!queries.includes('reservation."status" IN (${Prisma.join(statuses)})'),
  'PostgreSQL enum status must not be compared directly with text parameters');

for (const token of [
  "commandType: 'EXPIRE'",
  'createProductReservationLifecycleService',
  'findExpiredCandidates',
  'expiry:${candidate.id}:${candidate.expiresAt.toISOString()}',
]) assert.ok(expiry.includes(token), `Missing expiry authority: ${token}`);

assert.ok(expiryRoutes.includes("router.post('/run'"));
assert.ok(server.includes("app.use('/api/sales/reservations', productReservationMerchantRoutes)"));
assert.ok(server.includes("app.use('/api/sales/reservations/expiry', productReservationExpiryRoutes)"));

for (const forbidden of ['Sale.create', 'Payment.create', 'Delivery', 'OrderOnline.create']) {
  assert.ok(!routes.includes(forbidden) && !expiry.includes(forbidden), `Forbidden authority leaked: ${forbidden}`);
}

console.log('ProductReservation merchant workspace and expiry contract: PASS');
