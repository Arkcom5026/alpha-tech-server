# P1 QuickStock Runtime Progress — Backend

Last updated: 2026-07-05
Status: MODULE MOVED / DROPDOWN REPOSITORY STABILIZED / RECEIVE SERVICE READY FOR REPOSITORY EXTRACTION

## Purpose

This document records the current QuickStock backend state so a new task can continue without re-reading the whole conversation.

QuickStock has been moved under Product to match the frontend architecture. The backend now follows the Product module boundary, but the main receive service still needs a repository extraction pass.

## Current backend structure

```text
src/modules/product/
  create/
  quickStock/
    controllers/
      quickStockController.js
      quickReceiveDropdownController.js
    repositories/
      quickReceiveDropdownRepository.js
    routes/
      quickStockRoutes.js
    services/
      QuickStockService.js
      QuickStockServiceSingleton.js
      QuickStockService_Runtime_SafeTransaction.js
      quickReceiveDropdownService.js
```

## Important architecture decisions

1. QuickStock now lives under `src/modules/product/quickStock/`.
2. `server.js` should require:

   ```js
   require('./src/modules/product/quickStock/routes/quickStockRoutes')
   ```

   not the old `src/modules/quickStock` path.

3. QuickStock may borrow architectural ideas from Product Create, but must not import from Product Create.
4. Dropdown logic was adjusted to follow the Product Create pattern while remaining isolated inside QuickStock.
5. QuickStock routes should keep the public API stable for now:

   ```text
   /api/quick-stock/dropdowns
   /api/quick-stock/quick-enroll
   /api/quick-stock/all-in-one
   /api/quick-stock/existing
   ```

## Backend changes completed

### 1. Module relocation

Old location:

```text
src/modules/quickStock/
```

New location:

```text
src/modules/product/quickStock/
```

Relative path fixes already handled during the move:

- `server.js` route require path.
- `QuickStockServiceSingleton.js` prisma path.
- `QuickStockService.js` productTemplateEngine path.

### 2. Dropdown repository/service aligned with Product Create pattern

QuickStock dropdown now follows this logic:

- Template Branch is resolved by `branchCode = 'T01'`.
- ProductType dropdown is sourced from Template Branch ProductType rows directly.
- ProductType dedupe prefers `globalProductTypeId`, then normalized name.
- Brand dropdown is loaded through related ProductType family using `globalProductTypeId`.
- Units are loaded from Unit master.

Files:

```text
src/modules/product/quickStock/repositories/quickReceiveDropdownRepository.js
src/modules/product/quickStock/services/quickReceiveDropdownService.js
```

Important principle:

```text
Borrow the pattern from Product Create, not the dependency.
```

QuickStock does not import Product Create repository/service.

## Current backend runtime behavior

### Confirmed working from UI

The following frontend-visible runtime flow works:

```text
Select Template Product
  ↓
Create Operational Product from Template
  ↓
Operational Product adopted into QuickStock runtime
  ↓
UI state becomes OPERATIONAL_READY
```

### Existing receive runtime contract

Endpoint:

```text
POST /api/quick-stock/existing
```

Controller validates:

- branch context exists
- `productId` exists
- `costPrice > 0`
- `priceRetail > 0`
- at least one barcode/item exists
- queue item must not contain per-row price fields

Service currently handles:

- normalize queue items
- validate duplicate barcode in payload
- validate duplicate barcode in StockItem/SimpleLot
- validate duplicate serial in payload and StockItem
- find operational product in current branch
- clone from Template if product is not yet operational in branch
- upsert BranchPrice using runtime price as source of truth
- create StockItem for structured products
- create SimpleLot for simple products
- create StockMovement
- upsert StockBalance

## Known backend technical debt

### 1. `QuickStockService.js` is still too large

The file still directly contains Prisma queries for:

- Product lookup
- Product create in all-in-one flow
- Brand lookup/create
- BranchPrice create/update
- StockItem duplicate validation
- SimpleLot duplicate validation
- Serial duplicate validation
- StockItem createMany
- SimpleLot create
- StockMovement create
- StockBalance upsert

This should be extracted into a dedicated repository.

Recommended next structure:

```text
src/modules/product/quickStock/repositories/
  quickReceiveDropdownRepository.js
  quickStockRepository.js
```

Future `quickStockRepository.js` responsibilities:

- `findActiveProducts`
- `findProductTypes`
- `findStockByBranch`
- `findBrandByNormalizedName`
- `createBrand`
- `createProduct`
- `createBranchPrice`
- `findExistingBarcodes`
- `findExistingSerialNumbers`
- `findOperationalProductInBranch`
- `findClonedOperationalProduct`
- `upsertBranchPrice`
- `createStockItems`
- `createSimpleLot`
- `createStockMovement`
- `upsertStockBalance`

Service should keep only:

- validation
- runtime decisions
- transaction orchestration
- error wrapping
- trace orchestration

### 2. Naming still carries QuickReceive legacy

Some files are still named `quickReceiveDropdown...` even though they are under QuickStock. This is acceptable temporarily, but the long-term target is clearer naming:

```text
quickStockDropdownRepository.js
quickStockDropdownService.js
quickStockDropdownController.js
```

Do not rename until the current runtime is stable and tested, because route/controller references must be changed together.

### 3. All-in-One flow is legacy-ish

`quickStockInAllInOne` still creates Product/BranchPrice/Stock directly inside `QuickStockService.js`. It should eventually be split or deprecated depending on whether QuickStock continues to use Product Create + Existing Receive as the main path.

## Suggested next backend tasks

Recommended order:

1. Stabilization test pass:
   - Start server with `npm run dev`.
   - Confirm no `MODULE_NOT_FOUND` errors.
   - Call `/api/quick-stock/dropdowns`.
   - Create Operational Product from Template through UI.
   - Commit receive through `/api/quick-stock/existing`.

2. Extract `QuickStockRepository` from `QuickStockService.js`.

3. Keep behavior unchanged during extraction:
   - Do not change endpoint URLs.
   - Do not change payload contract.
   - Do not change stock movement semantics.
   - Do not change runtime price source of truth.

4. After repository extraction, optionally rename dropdown files from QuickReceive naming to QuickStock naming.

## Commit guidance

Recommended commit sequence:

- `docs(p1): record quickstock backend progress`
- `refactor(quickstock): extract runtime repository`
- `refactor(quickstock): rename dropdown workflow files`

Do not combine repository extraction with endpoint behavior changes.
