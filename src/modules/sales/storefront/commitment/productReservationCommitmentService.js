'use strict';

const crypto = require('crypto');
const repository = require('./productReservationCommitmentRepository');

const RESERVATION_TTL_MINUTES = 30;

const fail = (code, message, statusCode = 400, details = null) => {
  throw Object.assign(new Error(message), { code, statusCode, details });
};

const normalizeSlug = (value) => {
  const slug = String(value || '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail('COMMITMENT_STOREFRONT_INVALID', 'Invalid storefront slug');
  }
  return slug;
};

const normalizeToken = (value, code) => {
  const token = String(value || '').trim();
  if (!token || token.length < 32 || token.length > 512) {
    fail(code, 'Invalid commitment token', 401);
  }
  return token;
};

const normalizeIdempotencyKey = (value) => {
  const key = String(value || '').trim();
  if (!key || key.length < 16 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    fail('COMMITMENT_IDEMPOTENCY_INVALID', 'Invalid idempotency key');
  }
  return key;
};

const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');

const createReservationCode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PR-${timestamp}-${random}`;
};

const commitProductReservation = async ({ slug, sessionToken, identityProofToken, idempotencyKey }) => {
  const storefront = await repository.findStorefrontBySlug(normalizeSlug(slug));
  if (!storefront) fail('COMMITMENT_STOREFRONT_NOT_FOUND', 'Storefront was not found', 404);

  const key = normalizeIdempotencyKey(idempotencyKey);
  const branchId = Number(storefront.branchId);
  const existing = await repository.findExistingByIdempotency({ branchId, idempotencyKey: key });
  if (existing) return { replayed: true, reservation: existing };

  return repository.commit({
    branchId,
    sessionTokenHash: hashToken(normalizeToken(sessionToken, 'COMMITMENT_SESSION_TOKEN_INVALID')),
    proofTokenHash: hashToken(normalizeToken(identityProofToken, 'COMMITMENT_IDENTITY_PROOF_INVALID')),
    idempotencyKey: key,
    code: createReservationCode(),
    reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000),
  });
};

module.exports = Object.freeze({ RESERVATION_TTL_MINUTES, commitProductReservation });
