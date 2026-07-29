# Hybrid Runtime Ownership Audit — 2026-07-29

## Mission

Complete the remaining backend migration from legacy root-level runtime ownership into `src/modules/**` without changing public API behavior or introducing new business functionality.

This audit is based on production `main` at:

```text
8ad9652a8e6c6cccea662c3734abec9a8b80511d
```

## Migration Rule

```text
Behavior must remain.
Runtime ownership may move.
One module migration = one branch = one Draft PR.
```

A migration increment must not include product expansion, Prisma redesign, frontend changes, or unrelated cleanup.

## Current Server Entrypoint Findings

`server.js` is predominantly module-owned, but it still directly mounts two root-level route files:

```text
./routes/authRoutes
./routes/purchaseOrderReceiptSimpleRoutes
```

All other currently mounted business routes resolve through `src/modules/**`.

This establishes two categories of remaining legacy files:

1. **Active legacy runtime** — still imported by `server.js` or another active module path.
2. **Residual legacy files** — root-level files that coexist with module-owned runtime and require reference verification before deletion.

## Confirmed Active Legacy Runtime

### Authentication

```text
server.js
→ routes/authRoutes.js
→ legacy and/or module authentication controllers
```

Target:

```text
src/modules/auth/routes/authRoutes.js
→ src/modules/auth/controllers/**
```

Required checks:

- preserve all existing `/api/auth` endpoints
- preserve cookie/token behavior
- preserve employee login and lifecycle checks
- preserve middleware order
- prove no runtime import still needs root auth files before deletion

### Purchase Order Receipt Simple

```text
server.js
→ routes/purchaseOrderReceiptSimpleRoutes.js
→ controllers/purchaseOrderReceiptSimpleController.js
```

Target:

```text
src/modules/procurement/receipt/simple/**
```

Required checks:

- compare with existing `receiptSimpleRoutes`
- confirm whether both route groups represent separate API contracts or duplicate ownership
- preserve `/api/purchase-order-receipts-simple`
- avoid merging formal PO receipt and quick/simple receipt business rules

## Confirmed Residual / Duplicate-Looking Legacy Files

Repository search shows root controllers that have module counterparts, including at least:

```text
controllers/authController.js
controllers/brandController.js
controllers/productTypeController.js
controllers/productTypeBrandController.js
controllers/branchController.js
controllers/financeController.js
controllers/addressController.js
controllers/inputTaxReportController.js
controllers/superAdminCategoryController.js
controllers/employeeController.js
controllers/branchPriceController.js
controllers/combinedBillingController.js
controllers/barcodeController.js
controllers/stockAuditController.js
controllers/purchaseReportController.js
controllers/customerDepositController.js
```

These files are not automatically safe to delete. Each requires proof of:

```text
zero runtime imports
zero route mounts
zero script/test imports
zero compatibility entrypoint dependency
```

## Existing Branch Migration PR

PR #99 (`agent/branch-module-migration`) was created from an older baseline and is not mergeable with current `main`.

Current `main` already mounts:

```text
src/modules/branch/routes/branchRoutes.js
```

Therefore PR #99 must not be merged wholesale. Its remaining value is evidence for a targeted Branch residual-file audit. If current `main` has zero references to root Branch files, those files should be deleted through a new current-main migration increment.

## Migration Queue

### Increment 1 — Audit Authority

This document and Draft PR establish the current-main migration authority and queue.

### Increment 2 — Authentication Runtime Ownership

Move `/api/auth` entrypoint into `src/modules/auth` and retire root auth runtime only after reference verification.

### Increment 3 — Purchase Order Receipt Simple Ownership

Resolve the remaining root simple-receipt route/controller and move it into the procurement receipt module while preserving both route contracts where distinct.

### Increment 4 — Branch Residual Retirement

Verify and remove obsolete root Branch route/controller/constants if current module runtime is complete.

### Increment 5 — Duplicate Root Controller Retirement

Audit root files with module counterparts in bounded domain groups. Delete only files with zero runtime and verification dependencies.

Suggested groups:

```text
Catalog: brand, product type, category, unit, position
Location: address, locations
Finance/Reporting: finance, billing, deposits, reports
Inventory: barcode, stock audit, branch price
Employee/Auth: employee and onboarding residuals
```

### Final Increment — Legacy Root Retirement Certification

Required evidence:

```text
server.js has no business route import from ./routes/**
no module route/controller imports root business controllers
all remaining root files are explicitly classified as neutral infrastructure or historical/non-runtime
repository verifier passes
runtime startup passes
operational smoke tests pass
```

## Scope Exclusions

This migration agenda does not authorize:

- StoreCustomer runtime cutover
- Professional Access/Tenant implementation
- Input Tax 10/10 expansion
- ProductReservation lifecycle expansion
- Output Tax or Delivery redesign
- endpoint renaming
- response-schema changes
- Prisma model changes unless structurally required and separately authorized

## Current Gate

```text
Current-main audit: STARTED
Active root route mounts found: 2
Residual root controllers found: multiple
Runtime changes in this increment: NONE
Production impact: NONE
Next authorized increment: Authentication Runtime Ownership
```
