-- READ ONLY: every result set must contain zero rows unless explicitly documented.

-- Orphan stock item
SELECT wc."id", wc."claimNo", wc."stockItemId"
FROM "WarrantyClaim" wc
LEFT JOIN "StockItem" si ON si."id" = wc."stockItemId"
WHERE si."id" IS NULL;

-- Orphan branch
SELECT wc."id", wc."claimNo", wc."branchId"
FROM "WarrantyClaim" wc
LEFT JOIN "Branch" b ON b."id" = wc."branchId"
WHERE b."id" IS NULL;

-- Orphan supplier
SELECT wc."id", wc."claimNo", wc."supplierId"
FROM "WarrantyClaim" wc
LEFT JOIN "Supplier" s ON s."id" = wc."supplierId"
WHERE wc."supplierId" IS NOT NULL AND s."id" IS NULL;

-- Orphan legacy SaleReturnItem link
SELECT wc."id", wc."claimNo", wc."saleReturnItemId"
FROM "WarrantyClaim" wc
LEFT JOIN "SaleReturnItem" sri ON sri."id" = wc."saleReturnItemId"
WHERE wc."saleReturnItemId" IS NOT NULL AND sri."id" IS NULL;

-- Orphan event
SELECT e."id", e."warrantyClaimId"
FROM "WarrantyClaimEvent" e
LEFT JOIN "WarrantyClaim" wc ON wc."id" = e."warrantyClaimId"
WHERE wc."id" IS NULL;

-- Orphan completion command
SELECT c."id", c."warrantyClaimId"
FROM "WarrantyClaimCompletionCommand" c
LEFT JOIN "WarrantyClaim" wc ON wc."id" = c."warrantyClaimId"
WHERE wc."id" IS NULL;

-- Duplicate branch-scoped claim identity
SELECT "branchId", "claimNo", COUNT(*)
FROM "WarrantyClaim"
GROUP BY "branchId", "claimNo"
HAVING COUNT(*) > 1;

-- Duplicate future RepairJob identity
SELECT "branchId", "jobNo", COUNT(*)
FROM "RepairJob"
GROUP BY "branchId", "jobNo"
HAVING COUNT(*) > 1;
