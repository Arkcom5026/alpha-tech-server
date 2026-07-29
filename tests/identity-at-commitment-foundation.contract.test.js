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

const migration = read('prisma/migrations/20260729023000_identity_at_commitment_foundation/migration.sql');
const provider = read('src/modules/sales/storefront/identity/commerceOtpProvider.js');
const repository = read('src/modules/sales/storefront/identity/commerceIdentityRepository.js');
const service = read('src/modules/sales/storefront/identity/commerceIdentityService.js');
const controller = read('src/modules/sales/storefront/identity/commerceIdentityController.js');
const routes = read('src/modules/sales/storefront/identity/commerceIdentityRoutes.js');
const server = read('server.js');

assertIncludes(migration, 'CommerceIdentityChallenge', 'Identity challenge table is required');
assertIncludes(migration, 'CommerceCommitmentIdentity', 'Commitment identity proof table is required');
assertIncludes(migration, 'anonymousSessionId', 'Durable session linkage must use anonymousSessionId');
assertIncludes(migration, 'phoneNormalized', 'Durable phone field must use phoneNormalized');
assertIncludes(migration, 'otpHash', 'OTP must be persisted only as a verifier hash');
assertIncludes(migration, 'proofTokenHash', 'Commitment proof must be persisted only as a token hash');
assertExcludes(migration, 'customerId', 'Identity at commitment must not create customer account authority');
assertExcludes(migration, 'password', 'Identity challenge must not create password authority');
assertExcludes(migration, 'ProductReservation', 'Identity foundation must not create reservation authority');

assertIncludes(provider, 'crypto.randomInt', 'OTP generation must use cryptographic randomness');
assertIncludes(provider, "createHmac('sha256'", 'OTP verifier must use HMAC SHA-256');
assertIncludes(provider, 'timingSafeEqual', 'OTP verification must be timing safe');
assertIncludes(provider, 'COMMERCE_OTP_PROVIDER_NOT_CONFIGURED', 'Production must fail closed without a configured provider');

assertIncludes(repository, 'FOR UPDATE', 'Challenge verification must lock the challenge row');
assertIncludes(repository, 'attemptCount', 'Failed attempts must be durable');
assertIncludes(repository, "'LOCKED'", 'Challenge must lock after too many attempts');
assertIncludes(repository, '"anonymousSessionId"', 'Repository must use the durable anonymousSessionId column');
assertIncludes(repository, '"phoneNormalized"', 'Repository must use the durable phoneNormalized column');
assertIncludes(repository, '"proofTokenHash"', 'Repository must persist only proof hash');
assertIncludes(repository, '"cancelledAt"', 'Cancelled challenges must satisfy lifecycle constraints');
assertExcludes(repository, '"sessionId"', 'Repository SQL must not reference a nonexistent sessionId column');
assertExcludes(repository, '"phoneE164"', 'Repository SQL must not reference a nonexistent phoneE164 column');
assertExcludes(repository, 'Customer', 'Repository must not mutate customer authority');
assertExcludes(repository, 'ProductReservation', 'Repository must not create ProductReservation');
assertExcludes(repository, 'StockMovement', 'Repository must not create stock movement');

assertIncludes(service, 'MAX_ATTEMPTS = 5', 'Attempt limit must be explicit');
assertIncludes(service, 'OTP_TTL_MINUTES = 5', 'OTP lifetime must be explicit');
assertIncludes(service, 'PROOF_TTL_MINUTES = 10', 'Proof lifetime must be explicit');
assertIncludes(service, "crypto.randomBytes(32)", 'Proof token must use cryptographic randomness');
assertIncludes(service, "createHash('sha256')", 'Session and proof tokens must be hashed');
assertIncludes(service, 'prisma.$transaction', 'Verification must stay inside one transaction');
assertExcludes(service, 'createProductReservation', 'Identity verification must not create a reservation');

assertIncludes(controller, "X-Commerce-Identity-Proof", 'Verified identity proof must use explicit transport header');
assertIncludes(routes, "router.post('/request'", 'OTP request route is required');
assertIncludes(routes, "router.post('/verify'", 'OTP verify route is required');
assertExcludes(routes, 'verifyToken', 'Commitment identity routes must remain public pre-account routes');

const publicMount = "app.use('/api/sales/storefronts/:slug/identity', commerceIdentityRoutes);";
const authenticatedMount = "app.use('/api/sales', saleRoutes);";
assertIncludes(server, publicMount, 'Commitment identity routes must be mounted');
if (server.indexOf(publicMount) > server.indexOf(authenticatedMount)) {
  throw new Error('Commitment identity routes must be mounted before authenticated sales routes');
}
assertIncludes(server, "'X-Anonymous-Session-Token'", 'CORS must accept anonymous session token');
assertIncludes(server, "'X-Commerce-Identity-Proof'", 'CORS must expose commitment proof token');

console.log('Identity at Commitment Foundation contract: PASS');
