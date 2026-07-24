-- Product Service v4 post-migration reconciliation
-- Run after Phase 1 only. No row should be deleted.

BEGIN TRANSACTION READ ONLY;

SELECT 'WarrantyClaim' AS entity, COUNT(*) AS row_count FROM "WarrantyClaim"
UNION ALL
SELECT 'WarrantyClaimEvent', COUNT(*) FROM "WarrantyClaimEvent"
UNION ALL
SELECT 'WarrantyClaimCompletionCommand', COUNT(*) FROM "WarrantyClaimCompletionCommand";

SELECT
  COUNT(*) FILTER (WHERE "repairJobId" IS NULL) AS unlinked_legacy_claims,
  COUNT(*) FILTER (WHERE "repairJobId" IS NOT NULL) AS linked_claims,
  COUNT(*) FILTER (WHERE "saleReturnItemId" IS NOT NULL) AS preserved_legacy_sale_return_links
FROM "WarrantyClaim";

SELECT wc."id", wc."claimNo", wc."repairJobId", wc."branchId", rj."branchId" AS repair_branch_id
FROM "WarrantyClaim" wc
JOIN "RepairJob" rj ON rj."id" = wc."repairJobId"
WHERE wc."repairJobId" IS NOT NULL
  AND wc."branchId" <> rj."branchId";

SELECT wc."id", wc."claimNo", wc."saleReturnItemId"
FROM "WarrantyClaim" wc
LEFT JOIN "SaleReturnItem" sri ON sri."id" = wc."saleReturnItemId"
WHERE wc."saleReturnItemId" IS NOT NULL
  AND sri."id" IS NULL;

ROLLBACK;
