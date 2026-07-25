# Product Runtime Consolidation Baseline

Status: ACTIVE
Branch: `refactor/product-runtime-consolidation`
Tracking issue: #3
Baseline commit: `98b2a5fc90891bf5f7e5e3a3d60cc5fe17edb42f`

## Mission

Complete the migration of Product runtime authority into `src/modules/product` while preserving existing HTTP contracts and operational behavior. The new module must become the sole runtime authority before legacy files are retired.

## Current architecture classification

Product is in an **Advanced Hybrid Migration** state.

### New runtime authority already present

- `src/modules/product/create`
- `src/modules/product/trace`
- `src/modules/product/quickStock`
- Template product search under `src/modules/product`
- Existing-model duplicate preview under `src/modules/product`
- `src/modules/product/services/operationalProductRuntimeService`
- `src/modules/productType`
- `src/modules/productTemplate`

### Hybrid facade

- `routes/productRoutes.js`

The facade currently mixes:

- calls to legacy `controllers/productController.js`
- direct calls to new Product module services
- mounted Product module routes
- optional loading of a missing price controller

### Remaining legacy authority

- `controllers/productController.js`

This file still contains direct Prisma access, response mapping, validation, lifecycle logic, deletion analysis, image deletion behavior, and compatibility adapters.

### Missing runtime authority discovered

`routes/productRoutes.js` attempts to load `controllers/productPriceController.js` optionally. That file does not exist in the baseline repository. The affected pricing routes therefore fall back to `501 NOT_IMPLEMENTED` unless another runtime patch supplies the controller outside the repository.

Affected contracts:

- `GET /api/products/:productId/prices`
- `PUT /api/products/:productId/prices`
- `POST /api/products/:productId/prices`
- `DELETE /api/products/:productId/prices/:priceId`

Pricing must be treated as a **missing canonical Product runtime slice**, not merely a file move.

## Public Product HTTP contract baseline

The migration pass must preserve the following route paths and methods.

### Public online query

- `GET /api/products/online/dropdowns`
- `GET /api/products/online/search`
- `GET /api/products/online/detail/:id`

### Authenticated query

- `GET /api/products/dropdowns`
- `GET /api/products/duplicate-preview/*`
- `GET /api/products/pos/search`
- `GET /api/products/pos/runtime-by-template/:templateProductId`
- `GET /api/products/pos/:id`
- `GET /api/products/ready-to-sell`
- `GET /api/products/ready-to-sell/structured/:productId`
- `GET /api/products/`
- `GET /api/products/:id`

### Creation

- `POST /api/products/`
- `POST /api/products/pos/create-local`
- `POST /api/products/pos/create-from-template`

A separate canonical create runtime also exists at `/api/product-create` and must remain compatible during consolidation.

### Update and lifecycle

- `PATCH /api/products/:id`
- `POST /api/products/:id/disable`
- `POST /api/products/:id/enable`
- `PATCH /api/products/:id/archive`
- `POST /api/products/:id/migrate-to-simple`

### Delete

- `GET /api/products/:id/delete-check`
- `DELETE /api/products/:id`
- `DELETE /api/products/:id/images`

### Pricing

- `GET /api/products/:productId/prices`
- `PUT /api/products/:productId/prices`
- `POST /api/products/:productId/prices`
- `DELETE /api/products/:productId/prices/:priceId`

## Target vertical-slice ownership

```text
src/modules/product/
  create/
  update/

  query/
    dropdowns/
    list/
    detail/
    posSearch/
    posDetail/
    runtimeByTemplate/
    onlineSearch/
    onlineDetail/
    readyToSell/
    readyToSellDetail/
    duplicatePreview/

  lifecycle/
    enable/
    disable/
    archive/
    migrateToSimple/

  delete/
    check/
    product/
    image/

  pricing/
    list/
    create/
    update/
    delete/

  template/
  trace/
  quickStock/

  routes/
  contracts/
  policies/
  shared/
```

The exact folder names may be refined during implementation, but workflow ownership must remain local and reviewable.

## Slice execution order

### Slice 1 — Runtime inventory and contract baseline

Deliverables:

- enumerate public Product endpoints
- classify current runtime authority
- identify direct Prisma and cross-domain dependencies
- record missing pricing runtime
- establish migration invariants

Status: COMPLETE — Repository baseline created.

### Slice 2 — Query runtime extraction

Recommended internal order:

1. list and dropdowns
2. POS query adapters
3. online query adapters
4. ready-to-sell adapters
5. detail/runtime-by-template

Existing `operationalProductRuntimeService` behavior should be preserved first, then decomposed only where decomposition improves ownership without changing contracts.

### Slice 3 — Update runtime

Move update validation, category/type checks, branch-price handling, brand mapping, and transaction behavior into a complete vertical slice.

### Slice 4 — Lifecycle runtime

Move enable, disable, archive, and migrate-to-simple. Each operation must own its transition policy and refusal behavior.

### Slice 5 — Delete runtime

Move usage counting, delete eligibility, hard-delete refusal, image deletion, external image cleanup, and archive fallback behavior.

### Slice 6 — Pricing runtime

Implement the currently missing canonical runtime and preserve the existing route surface.

### Slice 7 — Canonical route assembly

Create a Product-owned router under `src/modules/product/routes` that assembles all Product slices without calling legacy controllers.

### Slice 8 — Runtime cutover

Mount the canonical Product router at `/api/products`. No silent legacy fallback is allowed after cutover.

### Slice 9 — Zero-reference verification

Verify no runtime import points to:

- `routes/productRoutes.js`
- `controllers/productController.js`
- any retired Product legacy helper

### Slice 10 — Legacy retirement

Delete legacy files only after Repository, Runtime, and Operational gates pass.

## Migration invariants

- Existing HTTP paths and methods remain unchanged during migration.
- Request and response compatibility takes priority over cleanup in the first pass.
- Branch isolation and authenticated actor context must be preserved.
- One workflow has one runtime authority.
- No controller calls another controller.
- No new monolithic Product service may replace the monolithic controller.
- Workflow-bound code stays inside its owning slice.
- Shared code is allowed only when neutral, stable, and proven to reduce rather than increase coupling.
- Legacy remains active only until controlled cutover.
- After cutover, rollback uses Git or route-level rollback—not hidden runtime fallback.
- Repository verification does not replace local Runtime or Operational verification.

## Cross-domain dependencies requiring care

Product deletion and lifecycle behavior currently touch or inspect data owned by:

- Stock
- Purchase orders and receipts
- Sales
- Online orders
- Cart
- Stock movement and simple lots
- Branch pricing
- Product images

Product query projections also depend on ProductType, GlobalProductType, Category, Brand, Unit, BranchPrice, and StockBalance relations.

These dependencies must be accessed through explicit repositories or stable contracts. They must not be hidden in controller-level Prisma calls after migration.

## Completion definition

Product Runtime Consolidation is complete only when:

1. every public Product endpoint is owned by `src/modules/product`
2. the canonical Product router contains no legacy controller import
3. pricing has a real runtime implementation
4. repository reference checks report zero active Product legacy imports
5. local Runtime verification passes
6. human Operational validation confirms Product, POS, stock intake, pricing, online, barcode, repair, and claim compatibility
