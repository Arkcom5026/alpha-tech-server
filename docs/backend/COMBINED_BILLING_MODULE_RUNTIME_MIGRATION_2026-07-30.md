# Combined Billing Module Runtime Migration

This increment moves the active Combined Billing runtime from the root `controllers/` structure into `src/modules/finance/combined-billing/` without changing endpoint contracts, document numbering, financial calculations, or the Sale lifecycle transition.

## Runtime ownership

```text
/api/combined-billing
→ src/modules/finance/combined-billing/routes/combinedBillingRoutes.js
→ src/modules/finance/combined-billing/combinedBillingController.js
→ src/modules/finance/combined-billing/runtime/combinedBillingRuntime.js
```

## Preserved endpoints

```text
GET /api/combined-billing/combinable-sales
POST /api/combined-billing/create
GET /api/combined-billing/combined-billing/:id
GET /api/combined-billing/with-pending-sales
```

## Preserved authority

- branch and employee context
- only `DELIVERED` Sales without a Combined Billing document
- same-customer validation
- branch-scoped Buddhist-year document numbering
- Decimal-safe pre-VAT, VAT and total aggregation
- atomic Combined Billing creation
- atomic Sale transition from `DELIVERED` to `FINALIZED`

## Explicit exclusions

- no endpoint change
- no response contract change
- no document-number rewrite
- no financial calculation rewrite
- no Prisma schema or migration change
- no Runtime PASS or Operational PASS claim
