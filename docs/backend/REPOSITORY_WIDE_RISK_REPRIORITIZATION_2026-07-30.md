# Repository-wide Cross-boundary Risk Reprioritization — 2026-07-30

## Scope

Re-audit active module and feature routes that still import root `controllers/` after the completed Finance and Reporting ownership migrations.

Authority branch:

```text
feature/sales-report-module-runtime
```

This is a repository-evidence inventory only. It does not claim Runtime PASS or Operational PASS.

## Confirmed remaining high-impact cross-boundary runtimes

### Priority 1 — Combined Billing / Tax-document authority

Active route:

```text
src/modules/finance/combined-billing/routes/combinedBillingRoutes.js
→ controllers/combinedBillingController.js
```

Risk authority:

- creates the branch-scoped combined billing document
- generates a branch + Buddhist-year/month running document code
- aggregates pre-VAT, VAT and grand total with Prisma Decimal
- connects multiple Sale records to one financial document
- changes eligible Sale status from `DELIVERED` to `FINALIZED`
- performs document creation and Sale transition atomically with `prisma.$transaction`

Why first:

This flow is not read-only. It owns document identity, financial totals, customer consistency and a lifecycle transition on source Sales. An ownership mistake could create duplicate document numbers, incorrect totals, cross-branch documents, or incorrectly finalized Sales.

Recommended next increment:

```text
feature/combined-billing-module-runtime
```

Preserve the existing runtime source first; do not rewrite numbering or transaction behavior without executable evidence.

### Priority 2 — Barcode / Inventory identity authority

Active route:

```text
src/modules/inventory/barcode/routes/barcodeRoutes.js
→ controllers/barcodeController.js
```

Risk authority:

- generates missing barcode identities for received inventory
- supports STRUCTURED/SN and SIMPLE/LOT modes
- reserves branch/month running numbers with `barcodeCounter`
- enforces the 0001–9999 monthly branch range
- creates barcode receipt records inside `prisma.$transaction`
- updates serial numbers, printed state, receipt completion and reprint state
- exposes receipt audit and scan-readiness projections

Why second:

This controller is an inventory identity authority. A defect may cause barcode collisions, missing stock identity, wrong branch ownership or broken receipt-to-stock traceability.

Recommended increment after Combined Billing:

```text
feature/barcode-module-runtime
```

The migration should remain source-preserving and must keep branch scope, atomic counter reservation, SN/LOT distinction and compatibility aliases.

### Priority 3 — Customer Deposit / Payment authority

Active route:

```text
src/modules/finance/customer-deposit/routes/customerDepositRoutes.js
→ controllers/customerDepositController.js
```

Risk authority:

- creates deposits from cash, transfer and card components
- calculates totals and remaining amount with Prisma Decimal
- scopes deposits by branch
- exposes update, delete and deposit-consumption operations
- projects customer identity, address and financial balances

Why third:

This flow owns customer money that may later be consumed by sales or payments. It is high impact, but the confirmed controller surface is narrower than Combined Billing document finalization and Barcode inventory identity generation.

Recommended increment:

```text
feature/customer-deposit-module-runtime
```

Runtime inspection must cover `useCustomerDeposit`, update and delete semantics before relocation is certified.

### Priority 4 — Payment Slip attachment authority

Active route:

```text
src/modules/commerce/payment-slip/routes/uploadSlipRoutes.js
→ controllers/upload/uploadSlipController.js
```

Risk authority:

- receives uploaded payment-slip files
- associates evidence with a target record
- depends on upload middleware and storage behavior

Why fourth:

It affects payment evidence and auditability, but based on current repository evidence it does not outrank the financial ledger/document transitions above. Controller and storage-provider inspection remains required before migration.

### Priority 5 — Remaining Inventory and document candidates

Further candidates requiring branch-authority verification include:

- stock audit routes and any residual root inventory controller imports
- order-online routes that may create Sale/Payment commitments
- tax-document, credit-note, debit-note or official-document runtime paths not returned reliably by the stale GitHub code-search index
- root controllers that are still mounted directly by `server.js`

These remain `UNVERIFIED` until exact authority-branch files and active server mounts are fetched.

## Updated execution order

```text
1. Combined Billing module runtime
2. Barcode module runtime
3. Customer Deposit module runtime
4. Payment Slip module runtime
5. Remaining inventory / payment / tax-document authority verification
```

## Evidence limitations

GitHub code search is indexed against an older commit and still returns files already migrated in the stacked PR sequence. Therefore:

- exact `fetch_file(..., ref=feature/sales-report-module-runtime)` evidence is authoritative
- search results are discovery hints only
- no final repository-wide count is claimed
- no file is considered dead only because search cannot find it

## Safety constraints

- no endpoint changes
- no financial, tax or inventory calculation rewrite
- no Prisma schema or migration changes
- no production deployment
- no Runtime PASS claim
- no Operational PASS claim
