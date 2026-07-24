-- Prisma vNext — Slice 1C-B
-- Explicit multi-branch migration for Bank and Position
--
-- Approved business decision:
--   * Operational branches: 2 and 5
--   * Existing Bank/Position rows become Branch 2 rows
--   * Equivalent rows are cloned for Branch 5
--   * Supplier.bankId and EmployeeProfile.positionId are remapped by name
--
-- IMPORTANT:
--   * This migration is designed for the discovered production state:
--       Branch IDs: 1, 2, 5
--       Bank rows: 14 (IDs 2..15), unique names
--       Position rows: 8 (IDs 1..7,10), unique names
--   * Branch 1 is a product template and receives no Bank/Position rows.
--   * The migration aborts before mutation when preconditions do not match.

BEGIN;

-- ============================================================================
-- 1. Hard preflight guards
-- ============================================================================

DO $$
DECLARE
  branch_count integer;
  bank_count integer;
  position_count integer;
  bank_duplicate_count integer;
  position_duplicate_count integer;
  unsupported_supplier_count integer;
  unsupported_employee_count integer;
BEGIN
  SELECT COUNT(*) INTO branch_count
  FROM "Branch"
  WHERE "id" IN (2, 5);

  IF branch_count <> 2 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: expected operational Branch IDs 2 and 5, found %',
      branch_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Bank'
      AND column_name = 'branchId'
  ) THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: Bank.branchId already exists; migration may have been partially applied';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Position'
      AND column_name = 'branchId'
  ) THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: Position.branchId already exists; migration may have been partially applied';
  END IF;

  SELECT COUNT(*) INTO bank_count FROM "Bank";
  IF bank_count <> 14 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: expected exactly 14 legacy Bank rows, found %',
      bank_count;
  END IF;

  SELECT COUNT(*) INTO position_count FROM "Position";
  IF position_count <> 8 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: expected exactly 8 legacy Position rows, found %',
      position_count;
  END IF;

  SELECT COUNT(*) INTO bank_duplicate_count
  FROM (
    SELECT "name"
    FROM "Bank"
    GROUP BY "name"
    HAVING COUNT(*) > 1
  ) duplicated_banks;

  IF bank_duplicate_count <> 0 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: duplicate legacy Bank names detected';
  END IF;

  SELECT COUNT(*) INTO position_duplicate_count
  FROM (
    SELECT "name"
    FROM "Position"
    GROUP BY "name"
    HAVING COUNT(*) > 1
  ) duplicated_positions;

  IF position_duplicate_count <> 0 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: duplicate legacy Position names detected';
  END IF;

  SELECT COUNT(*) INTO unsupported_supplier_count
  FROM "Supplier"
  WHERE "bankId" IS NOT NULL
    AND "branchId" NOT IN (2, 5);

  IF unsupported_supplier_count <> 0 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: % Supplier rows outside Branch 2/5 reference Bank',
      unsupported_supplier_count;
  END IF;

  SELECT COUNT(*) INTO unsupported_employee_count
  FROM "EmployeeProfile"
  WHERE "positionId" IS NOT NULL
    AND (
      "branchId" IS NULL
      OR "branchId" NOT IN (2, 5)
    );

  IF unsupported_employee_count <> 0 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: % EmployeeProfile rows without supported Branch 2/5 reference Position',
      unsupported_employee_count;
  END IF;
END $$;

-- ============================================================================
-- 2. Add nullable ownership columns
-- ============================================================================

ALTER TABLE "Bank"
  ADD COLUMN "branchId" INTEGER;

ALTER TABLE "Position"
  ADD COLUMN "branchId" INTEGER;

-- ============================================================================
-- 3. Remove legacy global uniqueness before cloning
-- ============================================================================
--
-- The legacy schema uses globally unique Bank.name and Position.name.
-- Cloning equivalent names for Branch 5 is impossible while those constraints
-- remain active. They are removed inside this transaction and replaced later
-- with branch-scoped unique indexes.
--
-- If any later statement fails, PostgreSQL rolls back these drops together
-- with the entire migration.

-- Prisma normally implements @unique as a UNIQUE INDEX rather than a
-- PostgreSQL UNIQUE CONSTRAINT. Drop both forms defensively so clone inserts
-- cannot be blocked by the legacy global-name uniqueness.
ALTER TABLE "Bank"
  DROP CONSTRAINT IF EXISTS "Bank_name_key";

DROP INDEX IF EXISTS "Bank_name_key";

ALTER TABLE "Position"
  DROP CONSTRAINT IF EXISTS "Position_name_key";

DROP INDEX IF EXISTS "Position_name_key";

-- ============================================================================
-- 4. Preserve deterministic legacy-to-clone mapping
-- ============================================================================

CREATE TEMP TABLE "_slice_1c_bank_map" (
  "legacyBankId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "targetBankId" INTEGER NOT NULL,
  PRIMARY KEY ("legacyBankId", "branchId"),
  UNIQUE ("targetBankId")
) ON COMMIT DROP;

CREATE TEMP TABLE "_slice_1c_position_map" (
  "legacyPositionId" INTEGER NOT NULL,
  "branchId" INTEGER NOT NULL,
  "targetPositionId" INTEGER NOT NULL,
  PRIMARY KEY ("legacyPositionId", "branchId"),
  UNIQUE ("targetPositionId")
) ON COMMIT DROP;

-- Existing rows are retained as Branch 2 ownership.
UPDATE "Bank"
SET "branchId" = 2;

INSERT INTO "_slice_1c_bank_map" ("legacyBankId", "branchId", "targetBankId")
SELECT "id", 2, "id"
FROM "Bank";

UPDATE "Position"
SET "branchId" = 2;

INSERT INTO "_slice_1c_position_map" (
  "legacyPositionId",
  "branchId",
  "targetPositionId"
)
SELECT "id", 2, "id"
FROM "Position";

-- Clone every Bank for Branch 5 and capture exact generated IDs.
WITH inserted AS (
  INSERT INTO "Bank" (
    "name",
    "createdAt",
    "updatedAt",
    "active",
    "branchId"
  )
  SELECT
    source."name",
    source."createdAt",
    source."updatedAt",
    source."active",
    5
  FROM "Bank" source
  WHERE source."branchId" = 2
  ORDER BY source."id"
  RETURNING "id", "name"
)
INSERT INTO "_slice_1c_bank_map" ("legacyBankId", "branchId", "targetBankId")
SELECT source."id", 5, inserted."id"
FROM "Bank" source
JOIN inserted ON inserted."name" = source."name"
WHERE source."branchId" = 2;

-- Clone every Position for Branch 5 and capture exact generated IDs.
WITH inserted AS (
  INSERT INTO "Position" (
    "name",
    "description",
    "createdAt",
    "updatedAt",
    "isActive",
    "branchId"
  )
  SELECT
    source."name",
    source."description",
    source."createdAt",
    source."updatedAt",
    source."isActive",
    5
  FROM "Position" source
  WHERE source."branchId" = 2
  ORDER BY source."id"
  RETURNING "id", "name"
)
INSERT INTO "_slice_1c_position_map" (
  "legacyPositionId",
  "branchId",
  "targetPositionId"
)
SELECT source."id", 5, inserted."id"
FROM "Position" source
JOIN inserted ON inserted."name" = source."name"
WHERE source."branchId" = 2;

-- ============================================================================
-- 5. Remap dependent records to same-branch master data
-- ============================================================================

UPDATE "Supplier" supplier
SET "bankId" = mapping."targetBankId"
FROM "_slice_1c_bank_map" mapping
WHERE supplier."bankId" = mapping."legacyBankId"
  AND supplier."branchId" = mapping."branchId"
  AND supplier."bankId" IS DISTINCT FROM mapping."targetBankId";

UPDATE "EmployeeProfile" employee
SET "positionId" = mapping."targetPositionId"
FROM "_slice_1c_position_map" mapping
WHERE employee."positionId" = mapping."legacyPositionId"
  AND employee."branchId" = mapping."branchId"
  AND employee."positionId" IS DISTINCT FROM mapping."targetPositionId";

-- ============================================================================
-- 6. Post-remap guards before constraints
-- ============================================================================

DO $$
DECLARE
  branch_2_bank_count integer;
  branch_5_bank_count integer;
  branch_2_position_count integer;
  branch_5_position_count integer;
  supplier_mismatch_count integer;
  employee_mismatch_count integer;
BEGIN
  SELECT COUNT(*) INTO branch_2_bank_count
  FROM "Bank"
  WHERE "branchId" = 2;

  SELECT COUNT(*) INTO branch_5_bank_count
  FROM "Bank"
  WHERE "branchId" = 5;

  IF branch_2_bank_count <> 14 OR branch_5_bank_count <> 14 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: expected 14 Banks per operational branch; Branch2=%, Branch5=%',
      branch_2_bank_count,
      branch_5_bank_count;
  END IF;

  SELECT COUNT(*) INTO branch_2_position_count
  FROM "Position"
  WHERE "branchId" = 2;

  SELECT COUNT(*) INTO branch_5_position_count
  FROM "Position"
  WHERE "branchId" = 5;

  IF branch_2_position_count <> 8 OR branch_5_position_count <> 8 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: expected 8 Positions per operational branch; Branch2=%, Branch5=%',
      branch_2_position_count,
      branch_5_position_count;
  END IF;

  SELECT COUNT(*) INTO supplier_mismatch_count
  FROM "Supplier" supplier
  JOIN "Bank" bank ON bank."id" = supplier."bankId"
  WHERE supplier."bankId" IS NOT NULL
    AND supplier."branchId" <> bank."branchId";

  IF supplier_mismatch_count <> 0 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: % Supplier.bankId rows cross branch ownership',
      supplier_mismatch_count;
  END IF;

  SELECT COUNT(*) INTO employee_mismatch_count
  FROM "EmployeeProfile" employee
  JOIN "Position" position ON position."id" = employee."positionId"
  WHERE employee."positionId" IS NOT NULL
    AND employee."branchId" <> position."branchId";

  IF employee_mismatch_count <> 0 THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: % EmployeeProfile.positionId rows cross branch ownership',
      employee_mismatch_count;
  END IF;
END $$;

-- ============================================================================
-- 7. Add branch ownership constraints
-- ============================================================================

ALTER TABLE "Bank"
  ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "Position"
  ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "Bank"
  ADD CONSTRAINT "Bank_branchId_fkey"
  FOREIGN KEY ("branchId")
  REFERENCES "Branch"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "Position"
  ADD CONSTRAINT "Position_branchId_fkey"
  FOREIGN KEY ("branchId")
  REFERENCES "Branch"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Bank_branchId_name_key"
  ON "Bank"("branchId", "name");

CREATE INDEX "Bank_branchId_idx"
  ON "Bank"("branchId");

CREATE UNIQUE INDEX "Position_branchId_name_key"
  ON "Position"("branchId", "name");

CREATE INDEX "Position_branchId_idx"
  ON "Position"("branchId");

-- ============================================================================
-- 8. Final invariant guard
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Bank"
    WHERE "branchId" NOT IN (2, 5)
  ) THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: Bank ownership exists outside approved Branch 2/5';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Position"
    WHERE "branchId" NOT IN (2, 5)
  ) THEN
    RAISE EXCEPTION
      'Slice 1C-B aborted: Position ownership exists outside approved Branch 2/5';
  END IF;
END $$;

COMMIT;
