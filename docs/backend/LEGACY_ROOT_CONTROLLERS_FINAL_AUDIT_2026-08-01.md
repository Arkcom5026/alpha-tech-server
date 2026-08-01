# Legacy Root Controllers — Final Migration Audit

Date: 2026-08-01  
Repository: `Arkcom5026/alpha-tech-server`  
Working branch: `refactor/finance-legacy-runtime-slice`  
Draft PR: #198

## Audit purpose

This document records the exhaustive inspection of the legacy root `controllers/` structure shown on `main` and classifies every visible file against the current feature branch.

The governing migration rule is:

```text
One business capability = one E2E slice
HTTP -> Controller -> Service -> Repository -> Prisma
```

A legacy root file may be retired only after a module-owned route/runtime or capability slice owns its behavior and the branch no longer contains the old file.

## Branch authority and comparison evidence

The branch was compared directly against `main` using GitHub commit comparison, not code-search index results.

At audit time:

- `main` comparison base: `46882daff1b50ab1ad5cbc39282f553f5290ab95`
- merge base: `5ef2b8a59c3b5829ed0f372b2aa584268076beb7`
- branch was 205 commits ahead and 55 commits behind `main`
- all legacy controller files listed below were either removed or recognized by GitHub as renamed into the new module runtime structure

Because the branch is behind `main`, final closure still requires synchronization and a repeat residual audit after conflict resolution. This document certifies the current feature-branch migration state only.

## Exhaustive legacy controller inventory

| Legacy path on `main` | Branch status | Canonical ownership on feature branch | Decision |
|---|---|---|---|
| `controllers/authController.js` | Renamed/migrated | `src/modules/auth/routes/sessionAuthRoutes.js` -> `src/modules/auth/session/runtime/*` | MIGRATED; legacy path retired |
| `controllers/barcodeController.js` | Removed | `src/modules/inventory/barcode/routes/barcodeRoutes.js` plus capability slices: generation, receipt-query, print-reprint, scan-serial, audit, receipt-completion | MIGRATED; legacy path retired |
| `controllers/branchController.js` | Removed | `src/modules/branch/routes/branchRoutes.js` -> `src/modules/branch/runtime/*` | MIGRATED; legacy path retired |
| `controllers/branchPriceController.js` | Removed | `src/modules/product/pricing/routes/branchPriceRoutes.js` -> `src/modules/product/pricing/runtime/*` | MIGRATED; legacy path retired |
| `controllers/brandController.js` | Removed | `src/modules/brand/routes/brandRoutes.js` and `productTypeBrandRoutes.js` -> `src/modules/brand/runtime/*` | MIGRATED; legacy path retired |
| `controllers/customerDepositController.js` | Removed | `src/modules/finance/customer-deposit/routes/customerDepositRoutes.js` -> `runtime/*` | MIGRATED; legacy path retired |
| `controllers/employeeOnboardingController.js` | Renamed/migrated | `src/modules/employee/onboarding/runtime/*` | MIGRATED; legacy path retired |
| `controllers/financeController.js` | Removed | `src/modules/finance/routes/financeRuntimeRoutes.js` -> `src/modules/finance/runtime/*` plus daily-closing slice | MIGRATED; legacy path retired |
| `controllers/inputTaxReportController.js` | Removed | `src/modules/reporting/tax/input/routes/inputTaxReportRoutes.js` -> `runtime/*` | MIGRATED; legacy path retired |
| `controllers/orderOnlineController.js` | Removed | `src/modules/commerce/order-online/routes/orderOnlineRoutes.js` -> `runtime/*` | MIGRATED; legacy path retired |
| `controllers/productTypeBrandController.js` | Removed | `src/modules/brand/routes/productTypeBrandRoutes.js` -> brand runtime | MIGRATED; legacy path retired |
| `controllers/productTypeController.js` | Removed | `src/modules/productType/routes/productTypeRoutes.js` and module-owned product-type slices | MIGRATED; legacy path retired |
| `controllers/purchaseOrderReceiptItemController.js` | Removed | `src/modules/procurement/receipt/item/add`, `item/update`, `item/delete`, `query/items`, `query/po-items` | MIGRATED and split by business capability; legacy path retired |
| `controllers/purchaseOrderReceiptSimpleController.js` | Removed | Procurement receipt module-owned simple receipt runtime/slices | MIGRATED; unmounted duplicate retired |
| `controllers/purchaseReportController.js` | Removed | `src/modules/reporting/purchase/routes/purchaseReportRoutes.js` -> `runtime/*` | MIGRATED; legacy path retired |
| `controllers/receiptSimpleController.js` | Removed | `src/modules/procurement/receipt/simple/routes/receiptSimpleRoutes.js` -> `runtime/*` | MIGRATED; legacy path retired |
| `controllers/salesReportController.js` | Removed | `src/modules/reporting/sales/routes/salesReportRoutes.js` -> `runtime/*` | MIGRATED; legacy path retired |
| `controllers/stockAuditController.js` | Removed | `src/modules/inventory/audit/routes/stockAuditRoutes.js` and module-owned audit runtime | MIGRATED; legacy path retired |
| `controllers/superAdminCategoryController.js` | Removed | `src/modules/category/routes/superAdminCategoryRoutes.js` -> `src/modules/category/super-admin/runtime/*` | MIGRATED; legacy path retired |
| `controllers/upload/uploadProductController.js` | Removed | `src/modules/product/media/routes/uploadProductRoutes.js` -> `runtime/*` | MIGRATED; legacy path retired |
| `controllers/upload/uploadSlipController.js` | Removed | `src/modules/commerce/payment-slip/routes/uploadSlipRoutes.js` -> `runtime/*` | MIGRATED; legacy path retired |

## Summary

```text
Legacy files audited             21
Migrated and retired             21
Partially migrated                0
Not migrated                      0
Compatibility files retained      0
Legacy controller files remaining 0 (on current feature branch, for this audited inventory)
```

## Important distinction

The `main/controllers/` directory still displays these files because PR #198 has not been merged. Their presence on `main` does not mean the feature branch migration failed. The feature branch already removes or renames every file in the audited inventory.

Likewise, GitHub code search may return historical paths from old commits. A path is treated as current only after branch-exact `fetch_file` or compare evidence confirms it.

## Remaining work before closing the agenda

The root-controller inventory shown in the screenshot is complete on the current feature branch. The migration agenda itself remains open until all of the following are completed:

1. Audit other legacy structures outside `controllers/`, including root `routes/`, root `services/`, root repositories, `src/features`, legacy/bridge/compatibility paths, and module controllers that still mix HTTP with Prisma.
2. Synchronize the branch with current `main` and resolve the 55-commit divergence.
3. Repeat the repository-wide residual audit after synchronization.
4. Update tests and verifiers so no retired path is referenced.
5. Run final targeted tests, module tests, full tests, syntax/startup verification, and ALDE certification on the final SHA.

## Current decision

```text
Screenshot controllers inventory   COMPLETE ON FEATURE BRANCH
Safe-to-delete legacy files         ALREADY DELETED/RENAMED IN PR #198
New migration slice required        NONE FOR THESE 21 FILES
Broader legacy structure audit      STILL OPEN
PR merge                             NOT PERFORMED
Final certification                 DEFERRED UNTIL RESIDUAL = 0
```
