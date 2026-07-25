# Product Backend Capability Migration Plan

Status: ACTIVE — Full Capability Migration
Branch: `refactor/product-backend-reference-module`
Tracks: #7

## Purpose

Migrate the complete Product Backend from hybrid legacy ownership into capability-owned module structure while preserving every public endpoint, authentication boundary, request contract, response contract, business result, and Prisma schema behavior.

The migration target is not a large shared Product controller/service/repository stack. The target is:

```text
Product Domain
→ Capability / Workflow Owner
→ Capability-owned Route
→ Capability-owned Controller
→ Capability-owned Service
→ Capability-owned Repository
→ Prisma
```

A capability receives only the layers required by its actual responsibility. Complex flows may own contracts, policies, mappers, builders, validators, or utilities; simple flows must not receive empty structural folders merely for symmetry.

## Canonical Architecture Standard

The Product migration follows the same ownership principle used by the Purchase Order reference module:

- each workflow has one runtime owner
- transport, orchestration, persistence, mapping, validation, and policy boundaries are explicit
- module root files compose capabilities but do not absorb their business logic
- legacy routes may remain temporarily as compatibility adapters only
- no business logic or direct Prisma access may remain in legacy controllers at completion
- every intermediate commit remains deployable

## Confirmed Current Stage

```text
HYBRID CAPABILITY MIGRATION
```

Production currently combines:

```text
Legacy Product Runtime
  server.js
  routes/productRoutes.js
  controllers/productController.js
  controllers/productPriceController.js

Capability-owned Product Runtime
  src/modules/product/create/
  src/modules/product/quickStock/
  src/modules/product/trace/

Partially modular Product root layers
  src/modules/product/controllers/
  src/modules/product/routes/
  src/modules/product/services/
  src/modules/product/repositories/
```

The root layers under `src/modules/product/` are transitional unless they are proven neutral composition boundaries. Files in those layers must be reassigned to capability owners rather than enlarged into another monolith.

## Existing Capability Owners

### Product Create

```text
src/modules/product/create/
  controllers/
  repositories/
  routes/
  services/
```

Responsibilities already include:

- branch context validation
- create-form dropdowns
- product-type/brand/unit validation
- local operational product creation
- product-type/brand association
- branch price creation
- transaction ownership

This capability is the preferred canonical owner for Product creation after compatibility contracts are reconciled.

### Quick Stock

```text
src/modules/product/quickStock/
  controllers/
  repositories/
  routes/
  services/
```

Responsibilities include quick receive workflows and workflow-specific dropdowns. Quick Stock remains an independent Product capability and must not be merged into generic Product services.

### Product Trace

```text
src/modules/product/trace/
  builders/
  contracts/
  controllers/
  mappers/
  policies/
  repositories/
  routes/
  services/
  utils/
  validators/
  index.js
```

Trace demonstrates the intended depth rule: capability structure expands only where real workflow complexity requires it.

## Production Route Surface

### Public Online Product Runtime

```text
GET /api/products/online/dropdowns
GET /api/products/online/search
GET /api/products/online/detail/:id
```

### Protected Operational Product Runtime

```text
GET  /api/products/dropdowns
GET  /api/products/pos/search
GET  /api/products/pos/runtime-by-template/:templateProductId
POST /api/products/pos/create-local
POST /api/products/pos/create-from-template
GET  /api/products/pos/:id
GET  /api/products/ready-to-sell
GET  /api/products/ready-to-sell/structured/:productId
```

### Product Catalog, Maintenance, and Lifecycle

```text
GET    /api/products
POST   /api/products
PATCH  /api/products/:id
POST   /api/products/:id/disable
POST   /api/products/:id/enable
GET    /api/products/:id/delete-check
PATCH  /api/products/:id/archive
GET    /api/products/:id
DELETE /api/products/:id
DELETE /api/products/:id/images
POST   /api/products/:id/migrate-to-simple
```

### Product Pricing Compatibility Surface

```text
GET    /api/products/:productId/prices
PUT    /api/products/:productId/prices
POST   /api/products/:productId/prices
DELETE /api/products/:productId/prices/:priceId
```

### Independently Mounted Product Capabilities

```text
/api/products/template
/api/products/trace
/api/products
/api/quick-stock
/api/product-create
```

Current mounting is operationally valid but composition ownership remains distributed in `server.js`. Final migration should provide a Product module composition boundary without changing these public paths.

## Responsibility Migration Matrix

| Current responsibility | Canonical capability owner |
| --- | --- |
| Operational administration list | `product/catalog` |
| Create-form dropdowns | `product/create` unless evidence proves a separate neutral query capability is required |
| Local product creation | `product/create` |
| Product update | `product/maintenance` |
| POS and online lookup/search | `product/runtime` |
| Runtime lookup by template | `product/runtime` |
| Ready-to-sell summary/details | `product/readyToSell` |
| Enable/disable policy | `product/lifecycle` |
| Delete eligibility | `product/lifecycle` |
| Archive and hard delete | `product/lifecycle` |
| Product image deletion | `product/media` |
| Structured-to-simple conversion | `product/stockModeMigration` |
| Product branch-price CRUD | `product/pricing` or an explicit adapter to the authoritative Branch Price module |
| Existing-model preview | `product/duplicatePreview` |
| Template search | `product/templateSearch` |
| Template cloning | `product/templateClone` |
| Quick receive | `product/quickStock` |
| Product history/timeline | `product/trace` |

Capability names may be refined after dependency inspection, but responsibilities must not be moved into a generic shared Product service merely to reduce folder count.

## Confirmed Transitional and Legacy Areas

```text
routes/productRoutes.js
controllers/productController.js
controllers/productPriceController.js
src/modules/product/controllers/
src/modules/product/routes/
src/modules/product/services/
src/modules/product/repositories/
src/modules/product/services/productCloneService.js
src/modules/product/services/productTemplateEngine/
src/modules/product/quickStock/services/QuickStockService_Runtime_SafeTransaction.js
```

No candidate may be deleted until import/reference inspection and runtime evidence prove it unused or safely replaced.

## Completed Migration Slice

### Operational Runtime HTTP Ownership Extraction

The following runtime adapters now delegate through a module controller:

- online search and detail
- POS search and detail
- operational lookup by template
- create local operational product
- create operational product from template
- ready-to-sell summary
- ready-to-sell structured details

Current shape:

```text
routes/productRoutes.js
→ src/modules/product/controllers/operationalProductRuntimeController.js
→ operationalProductRuntimeService.js
→ operationalProductRuntimeRepository.js
→ Prisma
```

Repository contract verification, syntax validation, regression tests, and Prisma validation have passed. This is a completed extraction slice, not completion of the Product migration.

## Implementation Plan

### Batch A — Creation Authority and Catalog

1. Compare the contracts of:
   - `POST /api/products`
   - `POST /api/products/pos/create-local`
   - `POST /api/product-create/create-local`
2. Extract one canonical create command under `product/create`.
3. Preserve each existing transport response through compatibility adapters.
4. Move `getAllProducts` into `product/catalog`.
5. Assign dropdown ownership based on actual consumers; do not create a generic shared service by assumption.

Acceptance:

- one Product creation business authority
- no create transaction remains in the legacy controller
- list/catalog Prisma access is capability-owned
- existing public contracts remain unchanged

### Batch B — Runtime Capability Normalization

1. Move operational runtime root files into `product/runtime`.
2. Split ready-to-sell behavior into `product/readyToSell`.
3. Move existing-model preview into `product/duplicatePreview`.
4. Move template search into `product/templateSearch`.
5. Preserve and split the existing controller contract verifier by capability.

Acceptance:

- runtime lookup and readiness projection have separate owners
- no workflow logic remains in Product root controller/service/repository folders for these capabilities

### Batch C — Maintenance, Pricing, and Media

1. Move update workflow into `product/maintenance`.
2. Move validation, mode normalization, product writes, branch-price writes, and response mapping into explicit layers.
3. Establish one pricing authority and retire optional controller loading/501 fallback.
4. Move product-image cleanup and external media handling into `product/media`.

Acceptance:

- Product maintenance controller performs transport mapping only
- pricing ownership is explicit
- media lifecycle is isolated from generic Product maintenance

### Batch D — Lifecycle and Stock Mode Migration

1. Move role/access policy, usage analysis, delete-check, archive, and hard-delete into `product/lifecycle`.
2. Treat cross-table usage counts as deletion-policy evidence, not a shared utility.
3. Move structured-to-simple conversion into `product/stockModeMigration`.
4. Make transaction, preconditions, reconciliation, and idempotency behavior explicit.

Acceptance:

- lifecycle policy and persistence are capability-owned
- stock-mode conversion is not hidden inside generic update logic

### Batch E — Template Clone Normalization and Legacy Retirement

1. Move template clone engine into `product/templateClone`.
2. Audit duplicate clone and Quick Stock support files before removal.
3. Introduce Product module composition boundary through `src/modules/product/index.js` and/or a route composer.
4. Reduce `server.js` knowledge of internal Product files without changing public mount paths.
5. Delete legacy Product controllers/routes or retain only thin compatibility adapters.
6. Add ownership and route-contract verifiers.

Acceptance:

Legacy files contain none of the following:

- Prisma access
- business rules
- transaction coordination
- workflow validation
- response projection
- optional runtime fallback

## Delivery Strategy

Implementation proceeds on the existing feature branch in large repository batches to reduce repetitive local pull/test loops:

```text
Batch A
→ Batch B
→ Batch C
→ Batch D
→ Batch E
→ Repository review
→ Single consolidated local verification
→ Targeted runtime patch only when evidence requires it
```

Every intermediate commit must remain deployable and preserve existing contracts.

## Migration Gates

```text
Architecture and Responsibility Map
→ Repository Implementation
→ Ownership and Contract Verification
→ Syntax/Test/Prisma Validation
→ Operational Runtime Verification
→ Human Functional Verification
→ CI
→ Merge Commit
→ Post-merge Verification
→ Branch Cleanup
```

## Current Gate Status

```text
Architecture Responsibility Map     PASS
Runtime Adapter Extraction           PASS
Runtime Controller Contract          PASS
Static Validation                    PASS
Regression Test                      PASS
Prisma Validation                    PASS
Complete Capability Ownership        IN PROGRESS
Legacy Retirement                    NOT STARTED
Operational Runtime Gate             DEFERRED UNTIL CONSOLIDATED MIGRATION
Merge                                BLOCKED WHILE DRAFT
```
