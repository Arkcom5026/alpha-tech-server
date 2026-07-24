-- Prisma vNext — Slice 1C-A
-- Multi-branch mapping discovery (READ ONLY)
-- Safe to run in Supabase SQL Editor. This script does not alter data.

-- ============================================================================
-- A. Branch authority
-- ============================================================================
SELECT
  "id",
  "name",
  "branchCode",
  "isHeadOffice",
  "taxId",
  "slug"
FROM "Branch"
ORDER BY "id";

-- ============================================================================
-- B. Existing Bank rows that require an ownership decision
-- ============================================================================
SELECT *
FROM "Bank"
ORDER BY "id";

-- ============================================================================
-- C. Existing Position rows that require an ownership/clone decision
-- ============================================================================
SELECT *
FROM "Position"
ORDER BY "id";

-- ============================================================================
-- D. Evidence for Position ownership from current employees
--    A position used by employees from multiple branches is a strong signal
--    that the legacy position should be cloned per branch, not assigned once.
-- ============================================================================
SELECT
  p."id" AS "positionId",
  p."name" AS "positionName",
  ep."branchId",
  b."name" AS "branchName",
  COUNT(*) AS "employeeCount"
FROM "EmployeeProfile" ep
JOIN "Position" p ON p."id" = ep."positionId"
LEFT JOIN "Branch" b ON b."id" = ep."branchId"
GROUP BY p."id", p."name", ep."branchId", b."name"
ORDER BY p."id", ep."branchId";

-- Position rows not referenced by any employee.
SELECT
  p."id",
  p."name",
  p."isActive",
  COUNT(ep."id") AS "employeeCount"
FROM "Position" p
LEFT JOIN "EmployeeProfile" ep ON ep."positionId" = p."id"
GROUP BY p."id", p."name", p."isActive"
HAVING COUNT(ep."id") = 0
ORDER BY p."id";

-- ============================================================================
-- E. Discover every foreign-key column currently referencing Bank or Position.
--    This prevents a clone migration from forgetting dependent records.
-- ============================================================================
SELECT
  tc.table_name AS "referencingTable",
  kcu.column_name AS "referencingColumn",
  ccu.table_name AS "referencedTable",
  ccu.column_name AS "referencedColumn",
  tc.constraint_name AS "constraintName"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.constraint_schema = kcu.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN ('Bank', 'Position')
ORDER BY ccu.table_name, tc.table_name, kcu.column_name;

-- ============================================================================
-- F. Candidate Bank-reference columns even when no FK exists.
-- ============================================================================
SELECT
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    lower(column_name) IN ('bankid', 'bank_id')
    OR lower(column_name) LIKE '%bank%id%'
  )
ORDER BY table_name, column_name;

-- ============================================================================
-- G. Candidate Position-reference columns even when no FK exists.
-- ============================================================================
SELECT
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    lower(column_name) IN ('positionid', 'position_id')
    OR lower(column_name) LIKE '%position%id%'
  )
ORDER BY table_name, column_name;

-- ============================================================================
-- H. Compact one-row summary for easy screenshot/copy
-- ============================================================================
SELECT jsonb_pretty(
  jsonb_build_object(
    'branches', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', b."id",
          'name', b."name",
          'branchCode', b."branchCode",
          'isHeadOffice', b."isHeadOffice"
        )
        ORDER BY b."id"
      )
      FROM "Branch" b
    ),
    'banks', (
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x."id")
      FROM (SELECT * FROM "Bank") x
    ),
    'positions', (
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x."id")
      FROM (SELECT * FROM "Position") x
    ),
    'positionUsage', (
      SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u."positionId", u."branchId"), '[]'::jsonb)
      FROM (
        SELECT
          p."id" AS "positionId",
          p."name" AS "positionName",
          ep."branchId",
          b."name" AS "branchName",
          COUNT(*) AS "employeeCount"
        FROM "EmployeeProfile" ep
        JOIN "Position" p ON p."id" = ep."positionId"
        LEFT JOIN "Branch" b ON b."id" = ep."branchId"
        GROUP BY p."id", p."name", ep."branchId", b."name"
      ) u
    )
  )
) AS "mappingDiscovery";
