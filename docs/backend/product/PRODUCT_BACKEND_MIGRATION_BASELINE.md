# Product Backend Migration Baseline

Status: ACTIVE — Slice 0 / Slice 1
Branch: `refactor/product-backend-reference-module`
Tracks: #7

## Purpose

Establish the evidence-backed baseline for migrating Product Backend from Hybrid Migration into canonical module ownership without changing behavior or API contracts.

## Confirmed Current Stage

```text
HYBRID
```

Production currently mixes:

```text
Legacy Production Runtime
  server.js
  routes/productRoutes.js
  controllers/productController.js

New Module Runtime
  src/modules/product/
  src/modules/quickStock/
```

Migration remains workflow-driven, incremental, and deployable at every intermediate commit.

## Production Route Surface

### Public online product runtime

```text
GET /api/products/online/dropdowns
GET /api/products/online/search
GET /api/products/online/detail/:id
```

Current owner: `controllers/productController.js`

### Protected operational product runtime

```text
GET  /api/products/dropdowns
GET  /api/products/pos/search
GET  /api/products/pos/runtime-by-template/:templateProductId
POST /api/products/pos/create-local
POST /api/products/pos/create-from-template
GET  /api/products/pos/:id
```

Current ownership split:

- Search/detail/dropdowns: legacy `productController`
- Create local/from template: route-local adapters delegating to `operationalProductRuntimeService`

### Product lifecycle and maintenance

```text
GET    /api/products
POST   /api/products
PATCH  /api/products/:id
POST   /api/products/:id/disable
POST   /api/products/:id/enable
GET    /api/products/:id/delete-check
PATCH  /api/products/:id/archive
DELETE /api/products/:id
DELETE /api/products/:id/images
POST   /api/products/:id/migrate-to-simple
```

Current owner: legacy `productController`

### Product pricing compatibility surface

```text
GET    /api/products/:productId/prices
PUT    /api/products/:productId/prices
POST   /api/products/:productId/prices
DELETE /api/products/:productId/prices/:priceId
```

Current owner: optional legacy `productPriceController`; route falls back to 501 when unavailable.

## Canonical Runtime Candidates

### Template Search

```text
src/modules/product/routes/templateProductSearchRoutes.js
src/modules/product/controllers/templateProductSearchController.js
src/modules/product/services/templateProductSearchService.js
src/modules/product/repositories/productTemplateRepository.js
```

### Operational Product Runtime

```text
src/modules/product/services/operationalProductRuntimeService.js
src/modules/product/repositories/operationalProductRuntimeRepository.js
```

Current service already owns substantial responsibilities:

- local operational product creation
- operational product creation from template
- branch-scoped operational lookup
- POS search projection
- online search/detail projection
- branch price payload normalization
- runtime mode decisions
- stock readiness projection

### Template Clone

```text
src/modules/product/services/productTemplateEngine/
```

Declared canonical clone engine.

### Quick Receive Commit Path

```text
POST /api/quick-stock/existing
→ quickStockController.quickStockExistingReceive
→ QuickStockService.quickReceiveExistingProduct
→ productTemplateEngine.cloneProductFromTemplate (when needed)
→ BranchPrice upsert
→ StockItem / SimpleLot
→ StockMovement
→ StockBalance
```

## Confirmed Legacy / Duplicate Candidates

```text
routes/productRoutes.js
controllers/productController.js
src/modules/product/services/productCloneService.js
src/modules/quickStock/services/QuickStockService_Runtime_SafeTransaction.js
src/modules/product/services/productTemplateEngine/QuickStockService.js
src/modules/product/services/productTemplateEngine/QuickStockService_auto_clone_patch.js
```

These files must not be deleted until reference and runtime dependency verification proves they are unused or safely replaceable.

## Immediate Architecture Finding

`routes/productRoutes.js` is no longer purely declarative. It contains two HTTP adapter functions:

- `createLocalOperationalProduct`
- `createOperationalProductFromTemplate`

Both already delegate to the module service. This is the safest first ownership slice because behavior is already module-owned; only transport ownership remains in the legacy route file.

## First Safe Migration Slice

### Slice 1A — Extract Operational Create HTTP Adapters

Target shape:

```text
routes/productRoutes.js
→ src/modules/product/controllers/operationalProductRuntimeController.js
→ operationalProductRuntimeService.js
→ operationalProductRuntimeRepository.js
→ Prisma
```

Scope:

- move the two route-local adapter functions into a module controller
- preserve routes, status codes, payloads, error codes, and logging semantics
- keep `routes/productRoutes.js` as the stable compatibility facade
- no Product CRUD migration in this slice
- no clone-engine deletion
- no QuickStock refactor
- no Prisma schema change

Acceptance:

- route file contains route declarations only for these two operations
- module controller owns request extraction and HTTP response mapping
- service/repository behavior remains unchanged
- existing frontend contracts remain unchanged
- build/test/runtime verification required before next slice

## Runtime Baseline Still Required

Before destructive cleanup or clone retirement, verify:

```text
Template Search
→ select template absent from branch
→ POST /api/quick-stock/existing
→ operational clone/lookup
→ BranchPrice uses runtime form values
→ stock records created
→ product visible in branch product list with price and stock
```

## Migration Gates

```text
Repository Review
→ Build/Test/Prisma Validation
→ Runtime Verification
→ Human Functional Verification
→ CI
→ Merge Commit
→ Post-merge Verification
→ Branch Cleanup
```
