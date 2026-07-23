-- This migration is intentionally atomic. Existing WarrantyClaim rows are preserved.
BEGIN;

-- Refuse to modify a drifted legacy shape or data that cannot be migrated safely.
DO $$
BEGIN
  IF to_regclass('public."WarrantyClaim"') IS NULL THEN
    RAISE EXCEPTION 'Expected table public."WarrantyClaim" was not found';
  END IF;

  IF to_regclass('public."WarrantyClaim_claimNo_key"') IS NULL THEN
    RAISE EXCEPTION
      'Expected unique index public."WarrantyClaim_claimNo_key" was not found; inspect schema drift before applying this migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WarrantyClaim_stockItemId_fkey'
      AND conrelid = 'public."WarrantyClaim"'::regclass
      AND contype = 'f'
  ) THEN
    RAISE EXCEPTION
      'Expected foreign key WarrantyClaim_stockItemId_fkey was not found; inspect schema drift before applying this migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."WarrantyClaim" wc
    LEFT JOIN "public"."StockItem" si ON si."id" = wc."stockItemId"
    WHERE si."id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'WarrantyClaim contains an orphan stockItemId; reconcile it before applying this migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."WarrantyClaim"
    WHERE "status"::text <> 'CLAIMED'
  ) THEN
    RAISE EXCEPTION
      'WarrantyClaim contains a legacy status other than CLAIMED; inspect it before applying this migration';
  END IF;
END
$$;

CREATE TYPE "public"."WarrantyClaimStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'IN_TRANSIT',
  'RECEIVED_BY_PROVIDER',
  'INSPECTING',
  'APPROVED',
  'REJECTED',
  'REPAIRING',
  'REPLACEMENT_PENDING',
  'CREDIT_PENDING',
  'RESOLVED',
  'CANCELLED'
);

CREATE TYPE "public"."WarrantyClaimResolution" AS ENUM (
  'REPAIRED',
  'REPLACED',
  'CREDITED',
  'REFUNDED',
  'RETURNED_UNCHANGED',
  'REJECTED',
  'WRITTEN_OFF'
);

ALTER TYPE "public"."StockMovementType" ADD VALUE IF NOT EXISTS 'CLAIM_OUT';
ALTER TYPE "public"."StockMovementType" ADD VALUE IF NOT EXISTS 'CLAIM_RETURN';
ALTER TYPE "public"."StockMovementType" ADD VALUE IF NOT EXISTS 'CLAIM_REPLACEMENT';
ALTER TYPE "public"."StockMovementType" ADD VALUE IF NOT EXISTS 'CLAIM_WRITE_OFF';

ALTER TABLE "public"."WarrantyClaim"
  ADD COLUMN "branchId" INTEGER,
  ADD COLUMN "supplierId" INTEGER,
  ADD COLUMN "saleReturnItemId" INTEGER,
  ADD COLUMN "previousClaimId" INTEGER,
  ADD COLUMN "serviceProvider" TEXT,
  ADD COLUMN "externalClaimRef" TEXT,
  ADD COLUMN "trackingNumber" TEXT,
  ADD COLUMN "resolution" "public"."WarrantyClaimResolution",
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "replacementStockItemId" INTEGER,
  ADD COLUMN "creditAmount" DECIMAL(12,2),
  ADD COLUMN "openedAt" TIMESTAMP(3),
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "providerReceivedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "createdByEmployeeId" INTEGER,
  ADD COLUMN "resolvedByEmployeeId" INTEGER;

-- StockItem.branchId is the sole permitted source for the legacy branch.
UPDATE "public"."WarrantyClaim" wc
SET "branchId" = si."branchId"
FROM "public"."StockItem" si
WHERE si."id" = wc."stockItemId";

-- createdAt is the only authoritative legacy timestamp for claim creation/opening.
UPDATE "public"."WarrantyClaim"
SET "openedAt" = "createdAt"
WHERE "openedAt" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "public"."WarrantyClaim"
    WHERE "branchId" IS NULL OR "openedAt" IS NULL
  ) THEN
    RAISE EXCEPTION
      'WarrantyClaim branchId/openedAt backfill was incomplete; no schema changes will be committed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "public"."WarrantyClaim"
    GROUP BY "branchId", "claimNo"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate WarrantyClaim(branchId, claimNo) identities must be reconciled before applying this migration';
  END IF;
END
$$;

ALTER TABLE "public"."WarrantyClaim"
  ALTER COLUMN "branchId" SET NOT NULL,
  ALTER COLUMN "openedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "openedAt" SET NOT NULL,
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "public"."WarrantyClaimStatus"
    USING (
      CASE "status"::text
        WHEN 'CLAIMED' THEN 'SUBMITTED'
      END
    )::"public"."WarrantyClaimStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

CREATE TABLE "public"."WarrantyClaimEvent" (
  "id" SERIAL NOT NULL,
  "warrantyClaimId" INTEGER NOT NULL,
  "status" "public"."WarrantyClaimStatus" NOT NULL,
  "note" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "performedByEmployeeId" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WarrantyClaimEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."WarrantyClaimCompletionCommand" (
  "id" SERIAL NOT NULL,
  "branchId" INTEGER NOT NULL,
  "commandKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "warrantyClaimId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WarrantyClaimCompletionCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarrantyClaim_branchId_claimNo_key"
  ON "public"."WarrantyClaim"("branchId", "claimNo");
CREATE INDEX "WarrantyClaim_stockItemId_openedAt_idx"
  ON "public"."WarrantyClaim"("stockItemId", "openedAt");
CREATE INDEX "WarrantyClaim_supplierId_openedAt_idx"
  ON "public"."WarrantyClaim"("supplierId", "openedAt");
CREATE INDEX "WarrantyClaim_saleReturnItemId_idx"
  ON "public"."WarrantyClaim"("saleReturnItemId");
CREATE INDEX "WarrantyClaim_previousClaimId_idx"
  ON "public"."WarrantyClaim"("previousClaimId");
CREATE INDEX "WarrantyClaim_replacementStockItemId_idx"
  ON "public"."WarrantyClaim"("replacementStockItemId");
CREATE INDEX "WarrantyClaim_createdByEmployeeId_idx"
  ON "public"."WarrantyClaim"("createdByEmployeeId");
CREATE INDEX "WarrantyClaim_resolvedByEmployeeId_idx"
  ON "public"."WarrantyClaim"("resolvedByEmployeeId");
CREATE INDEX "WarrantyClaim_branchId_status_openedAt_idx"
  ON "public"."WarrantyClaim"("branchId", "status", "openedAt");
CREATE INDEX "WarrantyClaimEvent_warrantyClaimId_occurredAt_idx"
  ON "public"."WarrantyClaimEvent"("warrantyClaimId", "occurredAt");
CREATE INDEX "WarrantyClaimEvent_performedByEmployeeId_occurredAt_idx"
  ON "public"."WarrantyClaimEvent"("performedByEmployeeId", "occurredAt");
CREATE UNIQUE INDEX "WarrantyClaimCompletionCommand_warrantyClaimId_key"
  ON "public"."WarrantyClaimCompletionCommand"("warrantyClaimId");
CREATE UNIQUE INDEX "WarrantyClaimCompletionCommand_branchId_commandKey_key"
  ON "public"."WarrantyClaimCompletionCommand"("branchId", "commandKey");
CREATE INDEX "WarrantyClaimCompletionCommand_branchId_createdAt_idx"
  ON "public"."WarrantyClaimCompletionCommand"("branchId", "createdAt");

-- The branch-scoped identity is in place before the legacy global uniqueness is removed.
DROP INDEX "public"."WarrantyClaim_claimNo_key";

-- Replace the historical-evidence-destroying cascade with RESTRICT.
ALTER TABLE "public"."WarrantyClaim"
  DROP CONSTRAINT "WarrantyClaim_stockItemId_fkey";

ALTER TABLE "public"."WarrantyClaim"
  ADD CONSTRAINT "WarrantyClaim_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WarrantyClaim_stockItemId_fkey"
    FOREIGN KEY ("stockItemId") REFERENCES "public"."StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WarrantyClaim_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "public"."Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WarrantyClaim_saleReturnItemId_fkey"
    FOREIGN KEY ("saleReturnItemId") REFERENCES "public"."SaleReturnItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WarrantyClaim_previousClaimId_fkey"
    FOREIGN KEY ("previousClaimId") REFERENCES "public"."WarrantyClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WarrantyClaim_replacementStockItemId_fkey"
    FOREIGN KEY ("replacementStockItemId") REFERENCES "public"."StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WarrantyClaim_createdByEmployeeId_fkey"
    FOREIGN KEY ("createdByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WarrantyClaim_resolvedByEmployeeId_fkey"
    FOREIGN KEY ("resolvedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."WarrantyClaimEvent"
  ADD CONSTRAINT "WarrantyClaimEvent_warrantyClaimId_fkey"
    FOREIGN KEY ("warrantyClaimId") REFERENCES "public"."WarrantyClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WarrantyClaimEvent_performedByEmployeeId_fkey"
    FOREIGN KEY ("performedByEmployeeId") REFERENCES "public"."EmployeeProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."WarrantyClaimCompletionCommand"
  ADD CONSTRAINT "WarrantyClaimCompletionCommand_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WarrantyClaimCompletionCommand_warrantyClaimId_fkey"
    FOREIGN KEY ("warrantyClaimId") REFERENCES "public"."WarrantyClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
