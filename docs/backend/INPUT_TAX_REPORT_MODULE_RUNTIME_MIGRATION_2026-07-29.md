# Input Tax Report Module Runtime Migration

This increment moves the active input-tax reporting runtime out of the root controller structure and into the reporting tax module without changing endpoint, filtering, tax calculations, or response payloads.

## Runtime ownership

```text
/api/input-tax-reports
→ src/modules/reporting/tax/input/routes/inputTaxReportRoutes.js
→ src/modules/reporting/tax/input/inputTaxReportController.js
→ src/modules/reporting/tax/input/runtime/inputTaxReportRuntime.js
```

## Preserved contracts

- branch scope from `req.user.branchId`
- `startDate` / `endDate` query range
- `month` / `year` compatibility query
- supplier tax invoice date and number requirements
- system supplier exclusion
- Decimal-safe subtotal, VAT and grand-total calculations
- no-cache report headers
- existing response payload

## Explicit exclusions

- no endpoint URL change
- no tax calculation rewrite
- no Prisma schema or migration change
- no frontend change
- no runtime or operational PASS claim
