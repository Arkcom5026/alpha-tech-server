# P1 QuickStock Runtime Progress — Backend

Last updated: 2026-07-06
Status: MODULE MOVED / DROPDOWN REPOSITORY STABILIZED / RUNTIME REPOSITORY EXTRACTION APPLIED / NEEDS STABILIZATION TEST

## Purpose

This document records the current QuickStock backend state so a new task can continue without re-reading the whole conversation.

QuickStock has been moved under Product to match the frontend architecture. The backend now follows the Product module boundary and now has both dropdown repository and runtime receive repository separation.

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
      quickStockRepository.js
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
5. Runtime receive logic now has a repository layer, but service remains the transaction/business orchestrator.
6. QuickStock routes should keep the public API stable for now:

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

### 3. Runtime repository extraction applied

Repository extraction has been applied for the main QuickStock runtime receive service.

Files:

```text
src/modules/product/quickStock/repositories/quickStockRepository.js
src/modules/product/quickStock/services/QuickStockService.js
```

Intent of this pass:

```text
Repository Extraction Only
```

Meaning:

- Endpoint URLs unchanged.
- Payload contracts unchanged.
- Response shape unchanged.
- Trace flow remains in service.
- Transaction orchestration remains in service.
- Prisma query calls moved into repository methods.

Current layer boundary:

```text
QuickStockController
  ↓
QuickStockService
  - validate
  - normalize payload
  - decide structured/simple
  - decide clone or not
  - open transaction
  - trace
  - return result
  ↓
QuickStockRepository
  - Prisma DB access
```

`quickStockRepository.js` currently contains runtime data-access methods such as:

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
- `findBranchPrice`
- `updateBranchPrice`
- `upsertBranchPriceManual`
- `createStockItems`
- `createStockMovements`
- `createStockMovement`
- `createSimpleLot`
- `upsertStockBalance`

## Current backend runtime behavior

### Confirmed working before repository extraction

The following frontend-visible runtime flow worked before runtime repository extraction:

```text
Select Template Product
  ↓
Create Operational Product from Template
  ↓
Operational Product adopted into QuickStock runtime
  ↓
UI state becomes OPERATIONAL_READY
```

### Needs retest after repository extraction

Because `QuickStockService.js` was replaced to route Prisma access through `QuickStockRepository`, the following must be retested before the next large refactor:

```text
npm run dev
```

Then verify:

- Server starts with no `MODULE_NOT_FOUND`.
- `/api/quick-stock/dropdowns` returns productTypes/brands/units.
- UI can select ProductType.
- UI can select Template Product.
- UI can create Operational Product from Template.
- UI can add barcode into queue.
- `/api/quick-stock/existing` can commit receive.
- StockItem / SimpleLot / StockMovement / StockBalance are created correctly.
- Duplicate barcode and duplicate serial validations still work.

## Existing receive runtime contract

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

Service handles:

- normalize queue items
- validate duplicate barcode in payload
- validate duplicate barcode in StockItem/SimpleLot through repository
- validate duplicate serial in payload and StockItem through repository
- find operational product in current branch through repository
- clone from Template if product is not yet operational in branch
- upsert BranchPrice using runtime price as source of truth through repository
- create StockItem for structured products through repository
- create SimpleLot for simple products through repository
- create StockMovement through repository
- upsert StockBalance through repository

## Known backend technical debt

### 1. `QuickStockService.js` is smaller but still large

The service no longer owns most direct Prisma queries, but it still owns both:

- `quickStockInAllInOne`
- `quickReceiveExistingProduct`

This is acceptable for now because the current pass preserved behavior. Future cleanup can split services by runtime command.

Recommended future service split:

```text
services/
  QuickStockService.js                 # adapter / facade
  QuickStockAllInOneService.js          # legacy all-in-one command
  QuickStockExistingReceiveService.js   # current receive command
```

Do not split until the repository extraction is fully tested.

### 2. Naming still carries QuickReceive legacy

Some files are still named `quickReceiveDropdown...` even though they are under QuickStock. This is acceptable temporarily, but the long-term target is clearer naming:

```text
quickStockDropdownRepository.js
quickStockDropdownService.js
quickStockDropdownController.js
```

Do not rename until the current runtime is stable and tested, because route/controller references must be changed together.

### 3. All-in-One flow is legacy-ish

`quickStockInAllInOne` is still supported. It has been routed through the repository layer, but it may eventually be deprecated depending on whether QuickStock continues to use Product Create + Existing Receive as the main path.

### 4. GlobalProductType is intentionally deferred

Current rule:

```text
GlobalProductType = Super Admin master taxonomy
ProductType = Template/Branch runtime type
Template T01 ProductType = source for Create / QuickStock dropdown and clone flow
```

GlobalProductType management can be built later because current real usage is only two IT branches. For now:

- Do not let store/runtime flows create GlobalProductType directly.
- Do not let store/runtime flows edit GlobalProductType directly.
- Keep using Template T01 ProductType as the runtime source.
- Ensure ProductType continues to carry a valid `globalProductTypeId`.

## Suggested next backend tasks

Recommended order:

1. Stabilization test pass after repository extraction:
   - Start server with `npm run dev`.
   - Confirm no `MODULE_NOT_FOUND` errors.
   - Call `/api/quick-stock/dropdowns`.
   - Create Operational Product from Template through UI.
   - Commit receive through `/api/quick-stock/existing`.

2. If stable, commit/push repository extraction:

   ```bash
   git add .
   git commit -m "refactor(quickstock): extract runtime repository"
   git push
   ```

3. After that, consider frontend duplicate API-call cleanup.

4. Later, optionally rename dropdown files from QuickReceive naming to QuickStock naming.

## Commit guidance

Recommended commit sequence:

- `refactor(quickstock): extract runtime repository`
- `docs(p1): update quickstock repository extraction status`
- `refactor(quick-stock): reduce duplicate search effects`
- `refactor(quickstock): rename dropdown workflow files`

Do not combine repository extraction with endpoint behavior changes.
