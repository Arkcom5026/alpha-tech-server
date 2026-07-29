# Purchase Report Module Runtime Migration

This increment moves the active Purchase Report runtime from the root `controllers/` structure into `src/modules/reporting/purchase/` without changing endpoints, filters, calculations, or response contracts.

## Runtime ownership

```text
/api/purchase-reports
→ src/modules/reporting/purchase/routes/purchaseReportRoutes.js
→ src/modules/reporting/purchase/purchaseReportController.js
→ src/modules/reporting/purchase/runtime/purchaseReportRuntime.js
```

## Preserved endpoints

```text
GET /api/purchase-reports
GET /api/purchase-reports/receipts
GET /api/purchase-reports/receipts/:receiptId
```

## Preserved meaning

- branch scope from the authenticated user
- PO and Quick Receipt supplier paths
- supplier, product, receipt-status and payment-status filters
- line-level, receipt-level and receipt-detail contracts
- Decimal-safe quantity × cost calculations
- system supplier exclusion

## Explicit exclusions

- no endpoint change
- no response contract change
- no report calculation rewrite
- no Prisma schema or migration change
- no runtime or operational PASS claim
