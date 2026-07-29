-- Identity at Commitment Foundation — Increment 3
-- Additive short-lived identity proof for commerce commitment.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommerceIdentityChallengePurpose') THEN
    CREATE TYPE "CommerceIdentityChallengePurpose" AS ENUM ('RESERVATION_COMMITMENT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CommerceIdentityChallengeStatus') THEN
    CREATE TYPE "CommerceIdentityChallengeStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'LOCKED', 'CANCELLED', 'CONSUMED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CommerceIdentityChallenge" (
  "id" SERIAL PRIMARY KEY,
  "anonymousSessionId" INTEGER NOT NULL,
  "purpose" "CommerceIdentityChallengePurpose" NOT NULL DEFAULT 'RESERVATION_COMMITMENT',
  "phoneNormalized" TEXT NOT NULL,
  "status" "CommerceIdentityChallengeStatus" NOT NULL DEFAULT 'PENDING',
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "resendCount" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommerceIdentityChallenge_session_fkey"
    FOREIGN KEY ("anonymousSessionId") REFERENCES "AnonymousShoppingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommerceIdentityChallenge_attempt_nonnegative" CHECK ("attemptCount" >= 0),
  CONSTRAINT "CommerceIdentityChallenge_resend_nonnegative" CHECK ("resendCount" >= 0),
  CONSTRAINT "CommerceIdentityChallenge_lifecycle_consistent" CHECK (
    ("status" = 'PENDING' AND "verifiedAt" IS NULL AND "consumedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'VERIFIED' AND "verifiedAt" IS NOT NULL AND "consumedAt" IS NULL AND "cancelledAt" IS NULL)
    OR ("status" = 'EXPIRED' AND "consumedAt" IS NULL)
    OR ("status" = 'LOCKED' AND "verifiedAt" IS NULL AND "consumedAt" IS NULL)
    OR ("status" = 'CANCELLED' AND "cancelledAt" IS NOT NULL AND "consumedAt" IS NULL)
    OR ("status" = 'CONSUMED' AND "verifiedAt" IS NOT NULL AND "consumedAt" IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS "CommerceCommitmentIdentity" (
  "id" SERIAL PRIMARY KEY,
  "anonymousSessionId" INTEGER NOT NULL,
  "challengeId" INTEGER NOT NULL UNIQUE,
  "phoneNormalized" TEXT NOT NULL,
  "proofTokenHash" TEXT NOT NULL UNIQUE,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommerceCommitmentIdentity_session_fkey"
    FOREIGN KEY ("anonymousSessionId") REFERENCES "AnonymousShoppingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CommerceCommitmentIdentity_challenge_fkey"
    FOREIGN KEY ("challengeId") REFERENCES "CommerceIdentityChallenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommerceIdentityChallenge_one_live_per_session_purpose"
  ON "CommerceIdentityChallenge"("anonymousSessionId", "purpose")
  WHERE "status" IN ('PENDING', 'VERIFIED');

CREATE INDEX IF NOT EXISTS "CommerceIdentityChallenge_expiry_idx"
  ON "CommerceIdentityChallenge"("status", "expiresAt");

CREATE INDEX IF NOT EXISTS "CommerceCommitmentIdentity_session_expiry_idx"
  ON "CommerceCommitmentIdentity"("anonymousSessionId", "expiresAt");