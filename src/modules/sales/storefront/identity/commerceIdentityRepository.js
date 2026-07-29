'use strict';

const { prisma, Prisma } = require('../../../../../lib/prisma');

const mapChallenge = (row) => ({
  id: Number(row.id),
  sessionId: Number(row.anonymousSessionId),
  purpose: row.purpose,
  phoneE164: row.phoneNormalized,
  otpHash: row.otpHash,
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
  SET "status" = 'CANCELLED',
      "cancelledAt" = CURRENT_TIMESTAMP,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "anonymousSessionId" = ${sessionId}
    AND "purpose" = ${purpose}::"CommerceIdentityChallengePurpose"
    AND "status" = 'PENDING'
`);

const createChallengeInDb = async ({ sessionId, purpose, phoneE164, otpHash, expiresAt }, db) => {
  await cancelPendingChallenges({ sessionId, purpose }, db);
  const rows = await db.$queryRaw(Prisma.sql`
    INSERT INTO "CommerceIdentityChallenge" (
      "anonymousSessionId", "purpose", "phoneNormalized", "otpHash", "status",
      "attemptCount", "resendCount", "expiresAt", "lastSentAt", "createdAt", "updatedAt"
    ) VALUES (
      ${sessionId}, ${purpose}::"CommerceIdentityChallengePurpose", ${phoneE164}, ${otpHash}, 'PENDING',
      0, 0, ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING *
  `);
  return mapChallenge(rows[0]);
};

const createChallenge = async (command, db = prisma) => {
  if (db !== prisma) return createChallengeInDb(command, db);
  return prisma.$transaction((tx) => createChallengeInDb(command, tx));
};

const findPendingChallengeForUpdate = async ({ challengeId, sessionId }, db = prisma) => {
  const rows = await db.$queryRaw(Prisma.sql`
    SELECT *
    FROM "CommerceIdentityChallenge"
    WHERE "id" = ${challengeId}
      AND "anonymousSessionId" = ${sessionId}
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

const verifyChallengeAndCreateProofInDb = async ({ challengeId, sessionId, phoneE164, proofExpiresAt }, db) => {
  const updated = await db.$queryRaw(Prisma.sql`
    UPDATE "CommerceIdentityChallenge"
    SET "status" = 'VERIFIED',
        "verifiedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${challengeId}
      AND "anonymousSessionId" = ${sessionId}
      AND "status" = 'PENDING'
      AND "expiresAt" > CURRENT_TIMESTAMP
    RETURNING *
  `);
  if (!updated[0]) return null;

  const proofs = await db.$queryRaw(Prisma.sql`
    INSERT INTO "CommerceCommitmentIdentity" (
      "challengeId", "anonymousSessionId", "phoneNormalized", "verifiedAt",
      "expiresAt", "createdAt"
    ) VALUES (
      ${challengeId}, ${sessionId}, ${phoneE164}, CURRENT_TIMESTAMP,
      ${proofExpiresAt}, CURRENT_TIMESTAMP
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
};

const verifyChallengeAndCreateProof = async (command, db = prisma) => {
  if (db !== prisma) return verifyChallengeAndCreateProofInDb(command, db);
  return prisma.$transaction((tx) => verifyChallengeAndCreateProofInDb(command, tx));
};

module.exports = Object.freeze({
  findActiveSessionByTokenHash,
  findStorefrontBySlug,
  createChallenge,
  findPendingChallengeForUpdate,
  registerFailedAttempt,
  verifyChallengeAndCreateProof,
});
