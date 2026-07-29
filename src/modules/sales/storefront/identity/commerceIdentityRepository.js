'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const mapChallenge = (row) => ({
  id: Number(row.id),
  sessionId: Number(row.sessionId),
  purpose: row.purpose,
  phoneE164: row.phoneE164,
  status: row.status,
  attemptCount: Number(row.attemptCount),
  resendCount: Number(row.resendCount),
  expiresAt: row.expiresAt,
  verifiedAt: row.verifiedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findActiveSessionByTokenHash = async ({ branchId, tokenHash }, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT "id", "branchId", "status", "expiresAt"
    FROM "AnonymousShoppingSession"
    WHERE "branchId" = ${branchId}
      AND "publicTokenHash" = ${tokenHash}
      AND "status" = 'ACTIVE'
      AND "expiresAt" > CURRENT_TIMESTAMP
    LIMIT 1
  `);
  return rows[0] || null;
};

const findStorefrontBySlug = async (slug, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT "branchId"
    FROM "PartnerStoreCapability"
    WHERE "storefrontSlug" = ${slug}
      AND "storefrontEnabled" = TRUE
    LIMIT 1
  `);
  return rows[0] || null;
};

const cancelPendingChallenges = async ({ sessionId, purpose }, db = prisma) => db.$executeRaw(Prisma.sql`
  UPDATE "CommerceIdentityChallenge"
  SET "status" = 'CANCELLED', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "sessionId" = ${sessionId}
    AND "purpose" = ${purpose}::"CommerceIdentityChallengePurpose"
    AND "status" = 'PENDING'
`);

const createChallenge = async ({ sessionId, purpose, phoneE164, otpHash, expiresAt }, db = prisma) => db.$transaction(async (tx) => {
  await cancelPendingChallenges({ sessionId, purpose }, tx);
  const rows = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "CommerceIdentityChallenge" (
      "sessionId", "purpose", "phoneE164", "otpHash", "status",
      "attemptCount", "resendCount", "expiresAt", "createdAt", "updatedAt"
    ) VALUES (
      ${sessionId}, ${purpose}::"CommerceIdentityChallengePurpose", ${phoneE164}, ${otpHash}, 'PENDING',
      0, 0, ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING *
  `);
  return mapChallenge(rows[0]);
});

const findPendingChallengeForUpdate = async ({ challengeId, sessionId }, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT *
    FROM "CommerceIdentityChallenge"
    WHERE "id" = ${challengeId}
      AND "sessionId" = ${sessionId}
    FOR UPDATE
  `);
  return rows[0] ? mapChallenge(rows[0]) : null;
};

const registerFailedAttempt = async ({ challengeId, maxAttempts }, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    UPDATE "CommerceIdentityChallenge"
    SET "attemptCount" = "attemptCount" + 1,
        "status" = CASE WHEN "attemptCount" + 1 >= ${maxAttempts} THEN 'LOCKED'::"CommerceIdentityChallengeStatus" ELSE "status" END,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${challengeId}
      AND "status" = 'PENDING'
    RETURNING *
  `);
  return rows[0] ? mapChallenge(rows[0]) : null;
};

const verifyChallengeAndCreateProof = async ({ challengeId, sessionId, phoneE164, proofTokenHash, proofExpiresAt }, db = prisma) => db.$transaction(async (tx) => {
  const updated = await tx.$queryRaw(Prisma.sql`
    UPDATE "CommerceIdentityChallenge"
    SET "status" = 'VERIFIED',
        "verifiedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${challengeId}
      AND "sessionId" = ${sessionId}
      AND "status" = 'PENDING'
      AND "expiresAt" > CURRENT_TIMESTAMP
    RETURNING *
  `);
  if (!updated[0]) return null;

  const proofs = await tx.$queryRaw(Prisma.sql`
    INSERT INTO "CommerceCommitmentIdentity" (
      "challengeId", "sessionId", "phoneE164", "proofTokenHash",
      "expiresAt", "createdAt", "updatedAt"
    ) VALUES (
      ${challengeId}, ${sessionId}, ${phoneE164}, ${proofTokenHash},
      ${proofExpiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id", "expiresAt", "createdAt"
  `);

  return {
    challenge: mapChallenge(updated[0]),
    proof: {
      id: Number(proofs[0].id),
      expiresAt: proofs[0].expiresAt,
      createdAt: proofs[0].createdAt,
    },
  };
});

module.exports = Object.freeze({
  findActiveSessionByTokenHash,
  findStorefrontBySlug,
  createChallenge,
  findPendingChallengeForUpdate,
  registerFailedAttempt,
  verifyChallengeAndCreateProof,
});