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
const server = read('server.js');

assertIncludes(migration, 'ProductReservation_public_idempotency_unique', 'Public idempotency uniqueness is required');
assertIncludes(migration, 'ProductReservation_commerce_identity_unique', 'One reservation per commerce identity is required');
assertIncludes(migration, 'ProductReservation_anonymous_session_unique', 'One reservation per anonymous session is required');
assertIncludes(migration, 'ProductReservation_actor_authority_consistent', 'Reservation actor authority guard is required');

assertIncludes(repository, 'db.$transaction', 'Commitment must execute atomically');
assertIncludes(repository, 'findExistingByIdempotency', 'Replay lookup must remain inside commitment authority');
assertIncludes(repository, 'COMMITMENT_IDEMPOTENCY_CONFLICT', 'Mismatched replay commands must be rejected');
const replayLookupIndex = repository.indexOf('existing: await findExistingByIdempotency');
const sessionLockIndex = repository.indexOf('FROM "AnonymousShoppingSession"');
const proofLockIndex = repository.indexOf('FROM "CommerceCommitmentIdentity"');
if (replayLookupIndex < 0 || sessionLockIndex < 0 || proofLockIndex < 0 || replayLookupIndex >= sessionLockIndex || replayLookupIndex >= proofLockIndex) {
  throw new Error('Idempotent replay must resolve before consumed session/proof state is revalidated so lost-response retries remain recoverable');
}
assertIncludes(repository, 'FOR UPDATE', 'Session, proof, items, and price authorities require row locks');
assertIncludes(repository, 'bp."isActive" = TRUE', 'Current BranchPrice activation field must be revalidated');
assertIncludes(repository, 'bp."effectiveDate"', 'Current BranchPrice effective date must be revalidated');
assertIncludes(repository, 'bp."expiredDate"', 'Current BranchPrice expiry date must be revalidated');
assertExcludes(repository, 'bp."active"', 'Stale BranchPrice active field must not be used');
assertExcludes(repository, 'bp."effectiveAt"', 'Stale BranchPrice effectiveAt field must not be used');
assertExcludes(repository, 'bp."expiresAt"', 'Stale BranchPrice expiresAt field must not be used');
assertIncludes(repository, '"quantity" - "reserved"', 'Current available stock must be revalidated');
assertIncludes(repository, '"reserved" = "reserved" +', 'Reservation must allocate stock durably');
assertIncludes(repository, "'RESERVE'::\"StockMovementType\"", 'Reservation stock movement must be recorded');
assertIncludes(repository, 'proofConsumed', 'Identity proof must be consumed atomically');
assertIncludes(repository, 'challengeConsumed', 'Identity challenge must be consumed atomically');
assertIncludes(repository, 'sessionCommitted', 'Anonymous session must transition atomically');
assertIncludes(repository, 'Number(proofConsumed) !== 1', 'Proof replay conflict must roll back');
assertIncludes(repository, 'Number(challengeConsumed) !== 1', 'Challenge replay conflict must roll back');
assertIncludes(repository, 'Number(sessionCommitted) !== 1', 'Session conflict must roll back');
assertIncludes(repository, 'unitPriceCents', 'Unit prices must be normalized before aggregation');
assertIncludes(repository, 'totalAmountCents', 'Totals must avoid floating-point accumulation');
assertIncludes(repository, '.toFixed(2)', 'Durable money writes must use two-decimal strings');
assertExcludes(repository, 'Payment', 'Commitment must not create payment authority');
assertExcludes(repository, 'Sale', 'Commitment must not create sale authority');
assertExcludes(repository, 'OrderOnline', 'Commitment must not mutate legacy OrderOnline');

assertIncludes(service, 'RESERVATION_TTL_MINUTES = 30', 'Reservation expiry policy must be explicit');
assertIncludes(service, "createHash('sha256')", 'Session and proof tokens must be hashed');
assertExcludes(service, 'price', 'Client-supplied price must not be accepted');
assertExcludes(service, 'quantity:', 'Client-supplied commitment quantity must not be accepted');
assertIncludes(controller, "req.get('X-Idempotency-Key')", 'Idempotency header is required');
assertIncludes(routes, "router.post('/', commitController)", 'Commitment route is required');
assertExcludes(routes, 'verifyToken', 'Commitment route must remain a public identity-proof boundary');
assertIncludes(server, "app.use('/api/sales/storefronts/:slug/commitment', productReservationCommitmentRoutes);", 'Commitment route must be mounted');

console.log('Product Reservation Commitment Authority Review contract: PASS');
