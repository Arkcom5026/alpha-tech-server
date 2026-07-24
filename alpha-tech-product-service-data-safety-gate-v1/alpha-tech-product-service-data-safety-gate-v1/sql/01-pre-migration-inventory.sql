-- READ ONLY: current row counts and relation coverage.
SELECT 'RepairJob' AS table_name, COUNT(*)::bigint AS row_count FROM "RepairJob"
UNION ALL SELECT 'WarrantyClaim', COUNT(*) FROM "WarrantyClaim"
UNION ALL SELECT 'WarrantyClaimEvent', COUNT(*) FROM "WarrantyClaimEvent"
UNION ALL SELECT 'WarrantyClaimCompletionCommand', COUNT(*) FROM "WarrantyClaimCompletionCommand"
UNION ALL SELECT 'SaleReturn', COUNT(*) FROM "SaleReturn"
UNION ALL SELECT 'SaleReturnItem', COUNT(*) FROM "SaleReturnItem"
ORDER BY table_name;

SELECT
  COUNT(*) AS warranty_claim_count,
  COUNT(*) FILTER (WHERE "saleReturnItemId" IS NOT NULL) AS legacy_sale_return_link_count,
  COUNT(*) FILTER (WHERE "previousClaimId" IS NOT NULL) AS previous_claim_link_count,
  COUNT(*) FILTER (WHERE "replacementStockItemId" IS NOT NULL) AS replacement_link_count
FROM "WarrantyClaim";
