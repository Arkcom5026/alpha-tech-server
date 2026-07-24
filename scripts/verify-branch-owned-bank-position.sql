-- Slice 1C-B — Post-migration verification (READ ONLY)

-- Expected:
-- Branch 2 = 14 Banks
-- Branch 5 = 14 Banks
SELECT
  "branchId",
  COUNT(*) AS "bankCount",
  COUNT(DISTINCT "name") AS "distinctBankNames"
FROM "Bank"
GROUP BY "branchId"
ORDER BY "branchId";

-- Expected:
-- Branch 2 = 8 Positions
-- Branch 5 = 8 Positions
SELECT
  "branchId",
  COUNT(*) AS "positionCount",
  COUNT(DISTINCT "name") AS "distinctPositionNames"
FROM "Position"
GROUP BY "branchId"
ORDER BY "branchId";

-- Expected: zero rows.
SELECT
  supplier."id" AS "supplierId",
  supplier."branchId" AS "supplierBranchId",
  supplier."bankId",
  bank."branchId" AS "bankBranchId",
  bank."name" AS "bankName"
FROM "Supplier" supplier
JOIN "Bank" bank ON bank."id" = supplier."bankId"
WHERE supplier."branchId" <> bank."branchId";

-- Expected: zero rows.
SELECT
  employee."id" AS "employeeId",
  employee."branchId" AS "employeeBranchId",
  employee."positionId",
  position."branchId" AS "positionBranchId",
  position."name" AS "positionName"
FROM "EmployeeProfile" employee
JOIN "Position" position ON position."id" = employee."positionId"
WHERE employee."branchId" <> position."branchId";

-- Expected: one row per Branch/name pair, count always 1.
SELECT "branchId", "name", COUNT(*) AS "duplicateCount"
FROM "Bank"
GROUP BY "branchId", "name"
HAVING COUNT(*) <> 1;

SELECT "branchId", "name", COUNT(*) AS "duplicateCount"
FROM "Position"
GROUP BY "branchId", "name"
HAVING COUNT(*) <> 1;

-- Compact result.
SELECT jsonb_pretty(
  jsonb_build_object(
    'bankCounts', (
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x."branchId")
      FROM (
        SELECT "branchId", COUNT(*) AS "count"
        FROM "Bank"
        GROUP BY "branchId"
      ) x
    ),
    'positionCounts', (
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x."branchId")
      FROM (
        SELECT "branchId", COUNT(*) AS "count"
        FROM "Position"
        GROUP BY "branchId"
      ) x
    ),
    'supplierCrossBranchCount', (
      SELECT COUNT(*)
      FROM "Supplier" supplier
      JOIN "Bank" bank ON bank."id" = supplier."bankId"
      WHERE supplier."branchId" <> bank."branchId"
    ),
    'employeeCrossBranchCount', (
      SELECT COUNT(*)
      FROM "EmployeeProfile" employee
      JOIN "Position" position ON position."id" = employee."positionId"
      WHERE employee."branchId" <> position."branchId"
    )
  )
) AS "slice1cBVerification";
