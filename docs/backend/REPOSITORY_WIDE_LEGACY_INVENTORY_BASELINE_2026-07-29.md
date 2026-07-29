# Repository-wide Legacy Inventory Baseline

Date: 2026-07-29
Repository: `Arkcom5026/alpha-tech-server`
Authority branch: `audit/repository-wide-legacy-inventory`
Base: `feature/auth-residual-retirement`

## Mission

Establish an evidence-qualified inventory of files that remain outside the target module-oriented runtime structure, classify their runtime status, and create the baseline for future migration increments.

## Definition

For this audit, a **legacy-structure candidate** is a source file under repository-root technical-type folders such as:

```text
controllers/
routes/
services/
repositories/
```

A file is not classified as removable merely because it is located outside `src/modules/`. It must be classified through runtime-mount and reference evidence.

Classification states:

- `ACTIVE_LEGACY_RUNTIME` — loaded by the current server/runtime graph.
- `COMPATIBILITY_RUNTIME` — intentionally retained compatibility surface.
- `DEAD_RUNTIME_CANDIDATE` — no discovered active mount/reference; deletion still requires head-qualified verification.
- `SHARED_INFRASTRUCTURE` — cross-module middleware/library/utility, not a legacy module candidate by location alone.
- `RETIRED` — removed on the authority branch.
- `UNVERIFIED` — discovered by repository search but not yet confirmed against the authority branch tree.

## Authority Limitation

GitHub code-search results observed during this audit were indexed against an older commit and still returned Auth files already removed on `feature/auth-residual-retirement`. Therefore search-result counts are discovery evidence only, not final tree authority.

The authoritative count must be produced from the exact authority-branch Git tree or an equivalent complete checkout/listing operation. Until that capability is available, this document deliberately avoids presenting a guessed repository-wide total.

## Confirmed Runtime Mount Evidence

`server.js` imports the canonical module-oriented routes for most runtime surfaces. One explicitly confirmed root route remains mounted:

```text
routes/purchaseOrderReceiptSimpleRoutes.js
```

via:

```text
const purchaseOrderReceiptSimpleRoutes = require('./routes/purchaseOrderReceiptSimpleRoutes');
```

This file is therefore classified as:

```text
ACTIVE_LEGACY_RUNTIME
```

It must not be deleted before its E2E ownership is migrated.

## Root `routes/` Discovery Set

Repository search discovered these root-route paths:

```text
routes/authRoutes.js
routes/brandRoutes.js
routes/productRoutes.js
routes/catalogRoutes.js
routes/loginEmployee.js
routes/taxReportRoutes.js
routes/productTypeRoutes.js
routes/currentEmployeeRoutes.js
routes/purchaseOrderReceiptSimpleRoutes.js
```

Head-qualified state:

- Auth paths are `RETIRED` by the parent branch:
  - `routes/authRoutes.js`
  - `routes/loginEmployee.js`
  - `routes/currentEmployeeRoutes.js`
- `routes/purchaseOrderReceiptSimpleRoutes.js` is `ACTIVE_LEGACY_RUNTIME` because `server.js` mounts it.
- Remaining discovered root routes are `UNVERIFIED` pending exact-tree and reference audit:
  - `routes/brandRoutes.js`
  - `routes/productRoutes.js`
  - `routes/catalogRoutes.js`
  - `routes/taxReportRoutes.js`
  - `routes/productTypeRoutes.js`

## Root `controllers/` Discovery Set

Repository search discovered at least the following controller paths:

```text
controllers/brandController.js
controllers/branchController.js
controllers/financeController.js
controllers/addressController.js
controllers/barcodeController.js
controllers/employeeController.js
controllers/stockAuditController.js
controllers/productTypeController.js
controllers/branchPriceController.js
controllers/orderOnlineController.js
controllers/salesReportController.js
controllers/receiptSimpleController.js
controllers/inputTaxReportController.js
controllers/purchaseReportController.js
controllers/combinedBillingController.js
controllers/customerDepositController.js
controllers/productTypeBrandController.js
controllers/upload/uploadSlipController.js
controllers/superAdminCategoryController.js
controllers/upload/uploadProductController.js
controllers/purchaseOrderReceiptItemController.js
controllers/purchaseOrderReceiptSimpleController.js
```

The search also returned Auth controllers already retired on the authority parent branch; they are excluded from the remaining-count baseline.

These 22 discovered non-Auth root controller paths are currently classified `UNVERIFIED` until each is checked against:

1. exact branch-tree existence,
2. canonical module imports,
3. server mount graph,
4. scripts/tests-only references,
5. replacement module ownership.

## Minimum Confirmed Baseline

At this stage the repository has:

```text
Confirmed active legacy runtime files: 1
  routes/purchaseOrderReceiptSimpleRoutes.js

Discovered non-Auth root controller candidates: 22
Discovered non-Auth root route candidates requiring verification: 5
Retired Auth root route files: 3
Retired Auth root controller files: 2
Retired legacy tenant controller/service files: 2
```

The number `28` (`1 + 22 + 5`) is a **minimum discovered candidate set**, not the final repository-wide legacy-file count. It excludes any files missed by code search, technical-type folders not yet enumerated, and nested legacy structures.

## Risk Order for Detailed Audit

1. `purchaseOrderReceiptSimpleRoutes.js` and its controller dependency — confirmed active root runtime.
2. Root controllers imported by canonical `src/modules/**/routes` — hybrid module ownership.
3. Root routes that duplicate canonical module routes — potential dead runtime.
4. Root upload controllers — verify whether neutral infrastructure or module-owned workflow.
5. Remaining technical-type folders and nested legacy structures.

## Required Next Gate

Produce an exact authority-branch file manifest and classify every candidate into:

```text
ACTIVE_LEGACY_RUNTIME
COMPATIBILITY_RUNTIME
DEAD_RUNTIME_CANDIDATE
SHARED_INFRASTRUCTURE
RETIRED
```

No deletion is authorized by this baseline report alone.
