-- Run before and after every migration phase. Save both outputs and diff them.
SELECT
  (SELECT COUNT(*) FROM "WarrantyClaim") AS warranty_claims,
  (SELECT COUNT(*) FROM "WarrantyClaimEvent") AS warranty_claim_events,
  (SELECT COUNT(*) FROM "WarrantyClaimCompletionCommand") AS warranty_claim_commands,
  (SELECT COUNT(*) FROM "SaleReturn") AS sale_returns,
  (SELECT COUNT(*) FROM "SaleReturnItem") AS sale_return_items,
  (SELECT COALESCE(SUM("creditAmount"), 0) FROM "WarrantyClaim") AS warranty_credit_total,
  (SELECT COALESCE(SUM("totalRefund"), 0) FROM "SaleReturn") AS sale_return_total_refund;
