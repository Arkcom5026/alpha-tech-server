-- READ ONLY: preserve the exact legacy WarrantyClaim -> SaleReturnItem evidence.
SELECT
  wc."id" AS "warrantyClaimId",
  wc."claimNo",
  wc."branchId" AS "claimBranchId",
  wc."stockItemId",
  wc."saleReturnItemId",
  sri."saleReturnId",
  sr."code" AS "saleReturnCode",
  sr."branchId" AS "saleReturnBranchId",
  sr."saleId",
  wc."openedAt",
  wc."createdAt"
FROM "WarrantyClaim" wc
LEFT JOIN "SaleReturnItem" sri ON sri."id" = wc."saleReturnItemId"
LEFT JOIN "SaleReturn" sr ON sr."id" = sri."saleReturnId"
WHERE wc."saleReturnItemId" IS NOT NULL
ORDER BY wc."id";
