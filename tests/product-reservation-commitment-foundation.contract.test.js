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

const migration = read('prisma/migrations/20260729033000_product_reservation_commitment_alignment/migration.sql');
const repository = read('src/modules/sales/storefront/commitment/productReservationCommitmentRepository.js');
const service = read('src/modules/sales/storefront/commitment/productReservationCommitmentService.js');
const controller = read('src/modules/sales/storefront/commitment/productReservationCommitmentController.js');
const routes = read('src/modules/sales/storefront/commitment/productReservationCommitmentRoutes.js');
const server = require('../scripts/read-server-composition-source').readServerCompositionSource(root);

assertIncludes(migration, 'ProductReservationActorType', 'Reservation actor authority is required');
assertIncludes(migration, 'CREATE TABLE "ProductReservation"', 'Reservation table must be created by canonical migration');
assertIncludes(migration, 'CREATE TABLE "ProductReservationItem"', 'Reservation item table must be created by canonical migration');
assertIncludes(migration, 'ProductReservationStatus', 'Reservation status must have one canonical enum authority');
assertIncludes(migration, "'ONLINE'", 'Online commitment source must be accepted by the canonical enum');
assertIncludes(migration, 'COMMERCE_IDENTITY', 'Public commitment actor type is required');
assertIncludes(migration, 'commerceIdentityId', 'Reservation must link to verified commerce identity');
assertIncludes(migration, 'anonymousSessionId', 'Reservation must link to anonymous session');
assertIncludes(migration, 'idempotencyKey', 'Public commitment must be idempotent');
assertIncludes(migration, 'ProductReservation_actor_authority_consistent', 'Internal and public actor shapes must be guarded');
assertIncludes(migration, 'ProductReservation_public_idempotency_unique', 'Public idempotency must be unique');

assertIncludes(repository, 'FOR UPDATE', 'Session, proof, items, and prices require locking');
assertIncludes(repository, 'proofTokenHash', 'Identity proof must be resolved by hash');
assertIncludes(repository, 'publicTokenHash', 'Idempotency replay must bind to the original session token hash');
assertIncludes(repository, 'COMMITMENT_IDEMPOTENCY_CONFLICT', 'Reused idempotency keys must reject different commands');
assertIncludes(repository, 'isActive', 'Current publication activation must be revalidated');
assertIncludes(repository, 'effectiveDate', 'Current publication start must be revalidated');
assertIncludes(repository, 'expiredDate', 'Current publication expiry must be revalidated');
assertExcludes(repository, 'bp."active"', 'Stale BranchPrice active field must not be used');
assertExcludes(repository, 'bp."effectiveAt"', 'Stale BranchPrice effectiveAt field must not be used');
assertExcludes(repository, 'bp."expiresAt"', 'Stale BranchPrice expiresAt field must not be used');
assertIncludes(repository, 'priceOnline', 'Server must read current online price');
assertIncludes(repository, 'unitPriceCents', 'Money must be normalized before aggregation');
assertIncludes(repository, 'totalAmountCents', 'Reservation totals must avoid floating-point accumulation');
assertIncludes(repository, '.toFixed(2)', 'Durable monetary writes must use two-decimal strings');
assertIncludes(repository, 'Number.isSafeInteger', 'Money arithmetic must enforce safe numeric bounds');
assertIncludes(repository, 'CAST(${totalAmount} AS numeric)', 'Reservation monetary strings must be cast to PostgreSQL numeric');
assertIncludes(repository, 'CAST(${unitPrice} AS numeric)', 'Reservation-item monetary strings must be cast to PostgreSQL numeric');
assertIncludes(repository, '"quantity" - "reserved"', 'Server must revalidate simple stock availability');
assertIncludes(repository, '"reserved" = "reserved" +', 'Commitment must allocate stock durably');
assertIncludes(repository, "'RESERVE'", 'Commitment must record reservation movement');
assertIncludes(repository, 'proofConsumed', 'Proof consumption must verify exactly one durable transition');
assertIncludes(repository, 'challengeConsumed', 'Challenge consumption must verify exactly one durable transition');
assertIncludes(repository, 'sessionCommitted', 'Session commitment must verify exactly one durable transition');
assertIncludes(repository, 'Number(proofConsumed) !== 1', 'Proof transition failure must roll back commitment');
assertIncludes(repository, 'Number(challengeConsumed) !== 1', 'Challenge transition failure must roll back commitment');
assertIncludes(repository, 'Number(sessionCommitted) !== 1', 'Session transition failure must roll back commitment');
assertExcludes(repository, 'req.body', 'Repository must not accept client transport authority');

assertIncludes(service, "createHash('sha256')", 'Session and proof tokens must be hashed');
assertIncludes(service, 'RESERVATION_TTL_MINUTES = 30', 'Reservation expiry policy must be explicit');
assertExcludes(service, 'findExistingByIdempotency', 'Replay validation must remain inside the commitment transaction');
assertExcludes(service, 'price', 'Client price must not be accepted by service');
assertExcludes(service, 'branchId:', 'Client branch ID must not be accepted by service input');
assertExcludes(service, 'quantity:', 'Client quantity must not be accepted at commitment');

assertIncludes(controller, "req.get('X-Anonymous-Session-Token')", 'Anonymous session token header is required');
assertIncludes(controller, "req.get('X-Commerce-Identity-Proof')", 'Identity proof header is required');
assertIncludes(controller, "req.get('X-Idempotency-Key')", 'Idempotency header is required');
assertIncludes(routes, "router.post('/', commitController)", 'Public commitment endpoint is required');
assertExcludes(routes, 'verifyToken', 'Public commitment route must not require employee authentication');

const publicMount = "app.use('/api/sales/storefronts/:slug/commitment', productReservationCommitmentRoutes);";
const authenticatedMount = "app.use('/api/sales', saleRoutes);";
assertIncludes(server, publicMount, 'Commitment route must be mounted');
if (server.indexOf(publicMount) > server.indexOf(authenticatedMount)) {
  throw new Error('Commitment route must be mounted before authenticated sales routes');
}
assertIncludes(server, "'X-Anonymous-Session-Token'", 'CORS must allow anonymous session token');
assertIncludes(server, "'X-Commerce-Identity-Proof'", 'CORS must allow identity proof token');
assertIncludes(server, "'X-Idempotency-Key'", 'CORS must allow idempotency key');

console.log('Product Reservation Commitment Foundation contract: PASS');
