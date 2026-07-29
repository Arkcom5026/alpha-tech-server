'use strict';

const crypto = require('crypto');
const repository = require('./commerceIdentityRepository');
const otpProvider = require('./commerceOtpProvider');

const OTP_TTL_MINUTES = 5;
const PROOF_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const PURPOSE = 'RESERVATION_COMMITMENT';

const fail = (code, message, statusCode = 400, details = null) => {
  throw Object.assign(new Error(message), { code, statusCode, details });
};

const normalizeSlug = (value) => {
  const slug = String(value || '').trim().toLowerCase();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail('COMMERCE_IDENTITY_STOREFRONT_INVALID', 'Invalid storefront slug');
  }
  return slug;
};

const normalizeSessionToken = (value) => {
  const token = String(value || '').trim();
  if (!token || token.length < 32 || token.length > 512) {
    fail('COMMERCE_IDENTITY_SESSION_TOKEN_INVALID', 'Invalid anonymous session token', 401);
  }
  return token;
};

const normalizePhone = (value) => {
  const raw = String(value || '').replace(/[\s()-]/g, '');
  if (/^0\d{9}$/.test(raw)) return `+66${raw.slice(1)}`;
  if (/^\+66\d{9}$/.test(raw)) return raw;
  fail('COMMERCE_IDENTITY_PHONE_INVALID', 'Phone number must be a valid Thai mobile number');
};

const tokenHash = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
const encodeOtpVerifier = ({ challengeSecret, otp }) => `${challengeSecret}.${otpProvider.hashOtp({ challengeSecret, otp })}`;
const decodeOtpVerifier = (value) => {
  const [challengeSecret, expectedHash, ...extra] = String(value || '').split('.');
  if (!challengeSecret || !expectedHash || extra.length) return null;
  return { challengeSecret, expectedHash };
};

const resolveContext = async ({ slug, sessionToken }) => {
  const storefront = await repository.findStorefrontBySlug(normalizeSlug(slug));
  if (!storefront) fail('COMMERCE_IDENTITY_STOREFRONT_NOT_FOUND', 'Storefront was not found', 404);
  const session = await repository.findActiveSessionByTokenHash({
    branchId: Number(storefront.branchId),
    tokenHash: tokenHash(normalizeSessionToken(sessionToken)),
  });
  if (!session) fail('COMMERCE_IDENTITY_SESSION_NOT_FOUND', 'Anonymous shopping session was not found', 404);
  return { branchId: Number(storefront.branchId), sessionId: Number(session.id) };
};

const requestCommitmentIdentity = async ({ slug, sessionToken, phone }) => {
  const context = await resolveContext({ slug, sessionToken });
  const phoneNormalized = normalizePhone(phone);
  const otp = otpProvider.generateOtp();
  const challengeSecret = otpProvider.generateChallengeSecret();
  const otpHash = encodeOtpVerifier({ challengeSecret, otp });
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const challenge = await repository.createChallenge({
    sessionId: context.sessionId,
    purpose: PURPOSE,
    phoneNormalized,
    otpHash,
    expiresAt,
  });
  await otpProvider.sendOtp({ phoneNormalized, otp, purpose: PURPOSE });
  return {
    challengeId: challenge.id,
    status: challenge.status,
    expiresAt: challenge.expiresAt,
    phoneMasked: `${phoneNormalized.slice(0, 5)}***${phoneNormalized.slice(-3)}`,
  };
};

const prismaTransaction = async (work) => {
  const { prisma } = require('../../../../../lib/prisma');
  return prisma.$transaction(work);
};

const verifyCommitmentIdentity = async ({ slug, sessionToken, challengeId, otp }) => {
  const context = await resolveContext({ slug, sessionToken });
  const id = Number(challengeId);
  if (!Number.isInteger(id) || id <= 0) fail('COMMERCE_IDENTITY_CHALLENGE_INVALID', 'Invalid challenge ID');
  const candidate = String(otp || '').trim();
  if (!/^\d{6}$/.test(candidate)) fail('COMMERCE_IDENTITY_OTP_INVALID', 'OTP must contain 6 digits');

  return prismaTransaction(async (tx) => {
    const challenge = await repository.findPendingChallengeForUpdate({ challengeId: id, sessionId: context.sessionId }, tx);
    if (!challenge) fail('COMMERCE_IDENTITY_CHALLENGE_NOT_FOUND', 'Identity challenge was not found', 404);
    if (challenge.status !== 'PENDING') fail('COMMERCE_IDENTITY_CHALLENGE_NOT_PENDING', 'Identity challenge is not pending', 409);
    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      fail('COMMERCE_IDENTITY_CHALLENGE_EXPIRED', 'Identity challenge has expired', 410);
    }

    const verifier = decodeOtpVerifier(challenge.otpHash);
    const valid = verifier && otpProvider.verifyOtp({
      challengeSecret: verifier.challengeSecret,
      otp: candidate,
      expectedHash: verifier.expectedHash,
    });
    if (!valid) {
      const updated = await repository.registerFailedAttempt({ challengeId: id, maxAttempts: MAX_ATTEMPTS }, tx);
      if (updated?.status === 'LOCKED') fail('COMMERCE_IDENTITY_CHALLENGE_LOCKED', 'Identity challenge is locked', 423);
      fail('COMMERCE_IDENTITY_OTP_MISMATCH', 'OTP did not match', 401, {
        attemptsRemaining: Math.max(0, MAX_ATTEMPTS - Number(updated?.attemptCount || 0)),
      });
    }

    const proofToken = crypto.randomBytes(32).toString('base64url');
    const proofExpiresAt = new Date(Date.now() + PROOF_TTL_MINUTES * 60 * 1000);
    const result = await repository.verifyChallengeAndCreateProof({
      challengeId: id,
      sessionId: context.sessionId,
      phoneNormalized: challenge.phoneNormalized,
      proofTokenHash: tokenHash(proofToken),
      proofExpiresAt,
    }, tx);
    if (!result) fail('COMMERCE_IDENTITY_CHALLENGE_CONFLICT', 'Identity challenge could not be verified', 409);

    return {
      proofToken,
      proof: {
        status: 'VERIFIED',
        expiresAt: result.proof.expiresAt,
        phoneMasked: `${challenge.phoneNormalized.slice(0, 5)}***${challenge.phoneNormalized.slice(-3)}`,
      },
    };
  });
};

module.exports = Object.freeze({
  OTP_TTL_MINUTES,
  PROOF_TTL_MINUTES,
  MAX_ATTEMPTS,
  PURPOSE,
  requestCommitmentIdentity,
  verifyCommitmentIdentity,
});
