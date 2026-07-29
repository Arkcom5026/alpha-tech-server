'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const include = (source, value, message) => {
  if (!source.includes(value)) throw new Error(message || `Expected source to include: ${value}`);
};
const exclude = (source, value, message) => {
  if (source.includes(value)) throw new Error(message || `Expected source to exclude: ${value}`);
};

const migration = read('prisma/migrations/20260729023000_identity_at_commitment_foundation/migration.sql');
const projection = read('prisma/commerce-identity.prisma');
const provider = read('src/modules/sales/storefront/identity/commerceOtpProvider.js');
const service = read('src/modules/sales/storefront/identity/commerceIdentityService.js');
const repository = read('src/modules/sales/storefront/identity/commerceIdentityRepository.js');
const routes = read('src/modules/sales/storefront/identity/commerceIdentityRoutes.js');
const server = read('server.js');

include(migration, 'CommerceIdentityChallenge');
include(migration, 'CommerceCommitmentIdentity');
include(migration, 'proofTokenHash');
include(migration, 'anonymousSessionId');
include(projection, 'model CommerceIdentityChallenge');
include(projection, 'model CommerceCommitmentIdentity');
include(projection, '@relation(fields: [anonymousSessionId]');
include(projection, '@unique');

include(provider, 'const hashOtp = ({ challengeSecret, otp })');
include(provider, 'const verifyOtp = ({ challengeSecret, otp, expectedHash })');
include(provider, 'const sendOtp = async ({ phoneNormalized, otp })');
include(service, 'otpProvider.hashOtp({ challengeSecret: otpVerifierSecret(), otp })');
include(service, 'otpProvider.verifyOtp({');
include(service, 'otpProvider.sendOtp({ phoneNormalized: phoneE164, otp, purpose: PURPOSE })');
include(service, 'COMMERCE_OTP_VERIFIER_SECRET');
include(service, 'COMMERCE_OTP_VERIFIER_NOT_CONFIGURED');
include(service, 'OTP_TTL_MINUTES = 5');
include(service, 'PROOF_TTL_MINUTES = 10');
include(service, 'MAX_ATTEMPTS = 5');
include(service, "crypto.randomBytes(32)");
include(service, "createHash('sha256')");
include(service, 'prisma.$transaction');

include(repository, 'FOR UPDATE');
include(repository, 'attemptCount');
include(repository, "'LOCKED'");
include(repository, 'proofTokenHash');
include(repository, 'status" = \'PENDING\'');
include(repository, 'expiresAt" > CURRENT_TIMESTAMP');

include(routes, "router.post('/request'");
include(routes, "router.post('/verify'");
exclude(routes, 'verifyToken');
include(server, "app.use('/api/sales/storefronts/:slug/identity', commerceIdentityRoutes);");
include(server, "'X-Commerce-Identity-Proof'");
exclude(service, 'createProductReservation');
exclude(repository, 'StockMovement');
exclude(repository, 'Customer');

console.log('Identity at Commitment Authority Review contract: PASS');
