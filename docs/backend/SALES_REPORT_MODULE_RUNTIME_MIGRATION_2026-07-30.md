# Sales Report Module Runtime Migration

This increment moves the active Sales Report runtime from the root `controllers/` structure into `src/modules/reporting/sales/` without changing endpoints, filters, calculations, or response contracts.

## Runtime ownership

```text
/api/sales-reports
→ src/modules/reporting/sales/routes/salesReportRoutes.js
→ src/modules/reporting/sales/salesReportController.js
→ src/modules/reporting/sales/runtime/salesReportRuntime.js
```

## Preserved endpoints

```text
GET /api/sales-reports/dashboard
GET /api/sales-reports/list
GET /api/sales-reports/product-performance
GET /api/sales-reports/detail/:saleId
GET /api/sales-reports/sales-tax
```

## Preserved meaning

- branch scope from the authenticated user
- date, status, payment-method and keyword filters
- dashboard totals, daily sales, growth and risk signals
- sales list pagination and sorting
- product performance aggregation
- sale detail response
- Decimal-safe sales-tax calculations

## Explicit exclusions

- no endpoint change
- no response contract change
- no report calculation rewrite
- no Prisma schema or migration change
- no runtime or operational PASS claim
