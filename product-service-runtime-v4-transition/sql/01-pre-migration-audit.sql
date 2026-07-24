-- Product Service v4 pre-migration audit
-- READ ONLY. Run in Supabase SQL Editor or psql and export the result.

BEGIN TRANSACTION READ ONLY;

SELECT 'WarrantyClaim' AS entity, COUNT(*) AS row_count FROM "WarrantyClaim"
UNION ALL
SELECT 'WarrantyClaimEvent', COUNT(*) FROM "WarrantyClaimEvent"
UNION ALL
SELECT 'WarrantyClaimCompletionCommand', COUNT(*) FROM "WarrantyClaimCompletionCommand"
UNION ALL
SELECT 'SaleReturnItem', COUNT(*) FROM "SaleReturnItem";

SELECT
  COUNT(*) FILTER (WHERE "saleReturnItemId" IS NOT NULL) AS claims_with_legacy_sale_return_link,
  COUNT(*) FILTER (WHERE "replacementStockItemId" IS NOT NULL) AS claims_with_replacement_item,
  COUNT(*) FILTER (WHERE "creditAmount" IS NOT NULL) AS claims_with_credit_amount
FROM "WarrantyClaim";

SELECT "branchId", "claimNo", COUNT(*)
FROM "WarrantyClaim"
GROUP BY "branchId", "claimNo"
HAVING COUNT(*) > 1;

SELECT wc."id", wc."claimNo", wc."saleReturnItemId"
FROM "WarrantyClaim" wc
LEFT JOIN "SaleReturnItem" sri ON sri."id" = wc."saleReturnItemId"
WHERE wc."saleReturnItemId" IS NOT NULL
  AND sri."id" IS NULL;

SELECT wc."id", wc."claimNo", wc."branchId", si."branchId" AS stock_branch_id
FROM "WarrantyClaim" wc
JOIN "StockItem" si ON si."id" = wc."stockItemId"
WHERE wc."branchId" <> si."branchId";

SELECT
  wc."id",
  wc."branchId",
  wc."claimNo",
  wc."stockItemId",
  wc."saleReturnItemId",
  wc."status",
  wc."resolution",
  wc."creditAmount",
  wc."openedAt",
  wc."createdAt"
FROM "WarrantyClaim" wc
ORDER BY wc."id";

ROLLBACK;
