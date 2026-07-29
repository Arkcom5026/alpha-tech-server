-- Product Reservation Commitment Foundation — Increment 4
-- Additive public-commitment alignment for the existing ProductReservation aggregate.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductReservationActorType') THEN
    CREATE TYPE "ProductReservationActorType" AS ENUM ('EMPLOYEE', 'COMMERCE_IDENTITY');
  END IF;
END $$;

ALTER TABLE "ProductReservation"
  ADD COLUMN IF NOT EXISTS "actorType" "ProductReservationActorType" NOT NULL DEFAULT 'EMPLOYEE',
  ADD COLUMN IF NOT EXISTS "commerceIdentityId" INTEGER,
  ADD COLUMN IF NOT EXISTS "anonymousSessionId" INTEGER,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

ALTER TABLE "ProductReservation"
  ALTER COLUMN "customerId" DROP NOT NULL,
  ALTER COLUMN "createdByEmployeeId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductReservation_commerceIdentityId_fkey'
  ) THEN
    ALTER TABLE "ProductReservation"
      ADD CONSTRAINT "ProductReservation_commerceIdentityId_fkey"
      FOREIGN KEY ("commerceIdentityId") REFERENCES "CommerceCommitmentIdentity"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductReservation_anonymousSessionId_fkey'
  ) THEN
    ALTER TABLE "ProductReservation"
      ADD CONSTRAINT "ProductReservation_anonymousSessionId_fkey"
      FOREIGN KEY ("anonymousSessionId") REFERENCES "AnonymousShoppingSession"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductReservation_actor_authority_consistent'
  ) THEN
    ALTER TABLE "ProductReservation"
      ADD CONSTRAINT "ProductReservation_actor_authority_consistent"
      CHECK (
        (
          "actorType" = 'EMPLOYEE'
          AND "customerId" IS NOT NULL
          AND "createdByEmployeeId" IS NOT NULL
          AND "commerceIdentityId" IS NULL
          AND "anonymousSessionId" IS NULL
        )
        OR
        (
          "actorType" = 'COMMERCE_IDENTITY'
          AND "customerId" IS NULL
          AND "createdByEmployeeId" IS NULL
          AND "commerceIdentityId" IS NOT NULL
          AND "anonymousSessionId" IS NOT NULL
        )
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductReservation_public_idempotency_unique"
  ON "ProductReservation"("branchId", "idempotencyKey")
  WHERE "actorType" = 'COMMERCE_IDENTITY' AND "idempotencyKey" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductReservation_commerce_identity_unique"
  ON "ProductReservation"("commerceIdentityId")
  WHERE "commerceIdentityId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ProductReservation_anonymous_session_unique"
  ON "ProductReservation"("anonymousSessionId")
  WHERE "anonymousSessionId" IS NOT NULL;
