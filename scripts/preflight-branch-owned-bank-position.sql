-- Slice 1C-B — Final production preflight (READ ONLY)
-- Run in Supabase SQL Editor immediately before prisma migrate deploy.

SELECT
  (SELECT COUNT(*) FROM "Branch" WHERE "id" IN (2,5)) AS "approvedBranchCount",
  (SELECT COUNT(*) FROM "Bank") AS "legacyBankCount",
  (SELECT COUNT(*) FROM "Position") AS "legacyPositionCount",
  (
    SELECT COUNT(*)
    FROM "Supplier"
    WHERE "bankId" IS NOT NULL
      AND "branchId" NOT IN (2,5)
  ) AS "unsupportedSupplierBankReferences",
  (
    SELECT COUNT(*)
    FROM "EmployeeProfile"
    WHERE "positionId" IS NOT NULL
      AND ("branchId" IS NULL OR "branchId" NOT IN (2,5))
  ) AS "unsupportedEmployeePositionReferences";

-- Expected exactly:
-- approvedBranchCount = 2
-- legacyBankCount = 14
-- legacyPositionCount = 8
-- unsupportedSupplierBankReferences = 0
-- unsupportedEmployeePositionReferences = 0
