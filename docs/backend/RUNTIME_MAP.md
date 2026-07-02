# Backend Runtime Map — P1 / Mission B

Status: ACTIVE BASELINE
Scope: alpha-tech-server backend understanding for Product Template → Quick Receive → Stock Runtime

## Purpose

This document is the backend-side map for Task boot, Mission planning, and runtime recovery.

P1 backend is currently in Hybrid Migration:

```txt
Legacy Production Runtime
  controllers/
  routes/
  prisma/

New Module Runtime
  src/modules/product/
  src/modules/quickStock/
```

Production compatibility remains the source of truth. New module architecture grows alongside the existing runtime and is reused when it is already available and safe.

## Incremental Backend Migration Doctrine

P1 backend must not be rewritten or migrated in one large step.

The approved migration model is:

```txt
Production Runtime first
→ Compatibility preserved
→ New module capability reused when available
→ Responsibilities extracted gradually
→ Every intermediate state deployable
```

### Core Rules

- Legacy `controllers/` and `routes/` remain valid production entrypoints until a workflow-specific migration replaces them safely.
- `src/modules/*` is the migration target and capability layer, not a reason to force refactor.
- New work should use existing production paths when they are the safest way to keep the workflow working.
- If module logic already exists and is stable, call/reuse it instead of copying logic into legacy controllers.
- If module logic is missing or risky, complete the operational workflow first with the smallest safe patch, then extract later.
- Do not move unrelated code just to make architecture look cleaner.
- Do not combine feature recovery with broad cleanup.
- Do not make a patch that leaves the system in a non-deployable intermediate state.

### Migration Trigger Rule

Migrate or extract backend responsibility only when one of these is true:

```txt
- The current workflow needs that responsibility.
- A bug fix requires touching that logic.
- A feature extension needs a cleaner boundary.
- The module already exists and is safer to reuse than duplicate.
- The Mission Architect explicitly approves a migration patch.
```

### Preferred Shape Over Time

```txt
Legacy Route
  ↓
Legacy Controller as Adapter
  ↓
Module Service / Runtime Engine
  ↓
Repository / Prisma Access
```

The long-term goal is thin controllers and reusable module runtime services, but this must happen through workflow-driven patches, not forced migration.

### Mission Assignment Rule

Every backend assignment must state:

```txt
- Is this production-runtime patch or migration patch?
- Which workflow checkpoint does it advance?
- Which legacy files are allowed?
- Which module files are allowed?
- What must not be refactored?
```

If this is not clear, the task must stop and ask ROLE-ARCH for clarification.

## Mission Execution Doctrine

Mission B is not a Backend Mission or Frontend Mission.

Mission B is the end-to-end operational workflow:

```txt
Template Search
→ Template Selection
→ Operational Product lookup/create/clone
→ BranchPrice ready
→ Stock intake
→ Product visible and usable in branch runtime
```

Technical layers are implementation domains inside the same mission.

## Current Mission B Runtime Finding

The backend already contains a near-complete Mission B runtime path through QuickStock Existing Receive:

```txt
GET  /api/products/template/search
POST /api/quick-stock/existing
```

The important runtime is:

```txt
Template Product from T01
  ↓
QuickStock existing receive
  ↓
If product is not operational in current branch:
  cloneProductFromTemplate(templateProductId, targetBranchId)
  ↓
BranchPrice clone/default
  ↓
Runtime BranchPrice upsert from Quick Receive form prices
  ↓
StockItem or SimpleLot
  ↓
StockMovement
  ↓
StockBalance
```

## High-Level Backend Flow

```txt
Frontend QuickStockPage
  ↓
/api/products/template/search
  ↓
src/modules/product/routes/templateProductSearchRoutes.js
  ↓
src/modules/product/controllers/templateProductSearchController.js
  ↓
src/modules/product/services/templateProductSearchService.js
  ↓
src/modules/product/repositories/productTemplateRepository.js
  ↓
Template Product rows from T01

Operator commits Quick Receive
  ↓
/api/quick-stock/existing
  ↓
src/modules/quickStock/routes/quickStockRoutes.js
  ↓
src/modules/quickStock/controllers/quickStockController.js
  ↓
src/modules/quickStock/services/QuickStockService.js
  ↓
quickReceiveExistingProduct()
  ↓
ProductTemplateEngine clone if needed
  ↓
BranchPrice upsert
  ↓
Stock runtime writes
```

## Important Files

### Template Search

#### `src/modules/product/routes/templateProductSearchRoutes.js`

Responsibility:
- Defines `GET /api/products/template/search` when mounted at `/api/products/template`.
- Applies `verifyToken`.
- Applies employee-context guard supporting legacy `req.user` and new `req.employee`.
- Delegates to `templateProductSearchController.searchTemplateProducts`.

This is the Product Template search entrypoint for FE QuickStock.

#### `src/modules/product/controllers/templateProductSearchController.js`

Responsibility:
- Calls `TemplateProductSearchService.searchTemplateProducts(req.query)`.
- Returns both `data` and `items` for frontend compatibility.
- Normalizes errors to response code/message/code.

#### `src/modules/product/services/templateProductSearchService.js`

Responsibility:
- Business layer for Template Product search.
- Resolves Template Branch code, defaulting to `T01`.
- Applies pagination and query filters.
- Maps each template product into frontend runtime shape.

Important mapped fields:

```txt
isTemplateProduct: true
templateProductId: product.id
templateBranchId
templateBranchCode
category/productType/brand/unit display fields
costPrice/priceRetail/priceWholesale/priceTechnician/priceOnline
hasPrice
branchPriceActive
```

#### `src/modules/product/repositories/productTemplateRepository.js`

Responsibility:
- Prisma query layer only.
- Owns `DEFAULT_TEMPLATE_BRANCH_CODE = 'T01'`.
- Finds Template Branch by `branchCode`.
- Builds Template Product query filters.
- Selects template product fields, product type, brand, unit, cover image, and branchPrice snapshot.

Repository should not own business decisions.

### QuickStock Runtime

#### `src/modules/quickStock/routes/quickStockRoutes.js`

Responsibility:
- Defines QuickStock module routes.
- Uses `verifyToken` and Hybrid employee guard.

Important endpoints:

```txt
POST /api/quick-stock/quick-enroll
POST /api/quick-stock/all-in-one
POST /api/quick-stock/existing
```

Mission B should treat `/existing` as the main Quick Receive commit path for Template/Operational Product runtime.

#### `src/modules/quickStock/controllers/quickStockController.js`

Responsibility:
- Controller adapter for QuickStock module.
- Extracts branch/employee context.
- Validates request contract at API boundary.
- Calls `QuickStockService`.

Important methods:

```txt
quickStockInAllInOne
quickStockExistingReceive
```

`quickStockExistingReceive` requires:

```txt
productId
costPrice
priceRetail
barcodes/items queue
```

It rejects price fields inside queue items because Runtime Session Price is the source of truth.

#### `src/modules/quickStock/services/QuickStockService.js`

Responsibility:
- Main QuickStock runtime service.
- Runtime Trace Edition v2.
- Owns safe runtime flow for QuickStock / Recovery / Template Clone Runtime.

Important method:

```txt
quickReceiveExistingProduct(data, currentBranchId, employeeId)
```

Current responsibilities:
- Normalize barcode queue.
- Validate duplicate barcodes before transaction.
- Validate duplicate serial numbers before transaction.
- Use Runtime form price as source of truth.
- Find operational product in current branch.
- If missing, call `cloneProductFromTemplate` from `productTemplateEngine`.
- Upsert BranchPrice using runtime price payload.
- Create StockItem or SimpleLot depending on product runtime mode.
- Create StockMovement.
- Upsert StockBalance.

This is currently the strongest candidate for Mission B end-to-end commit path.

#### `src/modules/quickStock/services/QuickStockService_Runtime_SafeTransaction.js`

Responsibility:
- Older / safety reference version of QuickStock runtime.
- Shows Safe Transaction pattern.
- Useful as historical reference, not the canonical active service unless imported by runtime.

Do not modify this file unless explicitly assigned.

### Product Template Engine

Canonical folder:

```txt
src/modules/product/services/productTemplateEngine/
```

This should be treated as the canonical clone engine for Mission B.

#### `src/modules/product/services/productTemplateEngine/index.js`

Responsibility:
- Exports the product clone service from `productTemplateEngine/productCloneService.js`.

#### `src/modules/product/services/productTemplateEngine/productCloneService.js`

Responsibility:
- Orchestrates Template Product → Operational Product clone.
- Supports standalone transaction and external transaction.
- Used by QuickStock runtime inside its own transaction.

Clone sequence:

```txt
validateTemplate
→ findExistingClone
→ cloneProductType
→ cloneBrandMapping
→ cloneProduct
→ cloneImages
→ cloneBranchPrice
→ afterCloneHooks
```

Important behavior:
- Prevents duplicate clone by `templateProductId + targetBranchId`.
- Returns existing product if clone already exists.
- Can run inside external transaction via `tx`.

#### `validateTemplate.js`

Responsibility:
- Finds Template Branch by `T01`.
- Validates active Template Product exists under Template Branch.
- Includes product images and source branchPrice.
- Rejects missing template product type.

#### `cloneProductType.js`

Responsibility:
- Ensures target branch has matching ProductType.
- Reuses existing by `branchId + globalProductTypeId + normalizedName`.
- Creates ProductType in target branch if missing.

#### `cloneBrandMapping.js`

Responsibility:
- Copies ProductTypeBrand mappings safely.
- Avoids try/catch swallowing `P2002` inside a transaction.
- Uses read-before-insert and `createMany({ skipDuplicates: true })`.

#### `cloneProduct.js`

Responsibility:
- Creates Operational Product from Template Product.
- Persists source identity:

```txt
templateProductId: templateProduct.id
```

Also copies important runtime fields:

```txt
name
mode
noSN
trackSerialNumber
categoryId
productTypeId
brandId
codeType
productConfig
unitId
warrantyDays
```

#### `cloneImages.js`

Responsibility:
- Copies template product images into cloned Operational Product.

#### `cloneBranchPrice.js`

Responsibility:
- Creates initial BranchPrice for cloned product from Template branchPrice.
- This is a default clone price.
- Quick Receive runtime may override it afterward with operator-entered runtime prices.

#### `afterCloneHooks.js`

Responsibility:
- Placeholder hook after clone.
- Currently returns true.
- Future extension point for post-clone side effects.

### Non-canonical / Legacy Clone Service

#### `src/modules/product/services/productCloneService.js`

Responsibility:
- Older standalone clone service.
- Has its own clone Product, ProductType, BrandMapping, BranchPrice logic.

Mission B should avoid using this as the canonical path unless a later assignment explicitly chooses it.

Canonical clone engine is:

```txt
src/modules/product/services/productTemplateEngine/
```

## Mission B Current Checkpoints

```txt
B-01 Template Search                 ✅ Ready
B-02 Template Selection              ✅ Ready
B-03 Operational Lookup              ✅ Ready / FE prepared
B-04 Clone/Create Operational Product ✅ Engine exists
B-05 BranchPrice Ready               ✅ Clone default + runtime upsert exists
B-06 Stock Intake                    ✅ QuickReceive runtime exists
B-07 End-to-End Runtime Verification ⏳ Next required checkpoint
```

## Current Next Step

Do not add more feature code before verification.

Next recommended assignment:

```txt
ASSIGNMENT-017 — Mission B End-to-End Runtime Verification
```

Test target:

```txt
Template Search
→ select Template not yet in branch
→ Quick Receive commit through /api/quick-stock/existing
→ ProductTemplateEngine clones product if needed
→ BranchPrice upsert uses runtime form prices
→ stock runtime creates inventory
→ product appears in branch product list with price and stock
```

## Architecture Rules

- Mission B is workflow-centric, not FE/BE-centric.
- Production runtime remains source of truth.
- New module runtime should be reused when available.
- Do not force migration.
- Do not duplicate product template clone logic outside `productTemplateEngine`.
- Do not split workflow into technical missions.
- Every patch must advance the operational workflow.
- Every intermediate state must remain deployable.

## Risk Register

1. Duplicate clone logic exists in `src/modules/product/services/productCloneService.js` and `productTemplateEngine/`. Prefer `productTemplateEngine`.
2. `/api/products/pos/create-from-template` was added as a route-level blocker removal, but QuickStock `/existing` may already be the stronger end-to-end runtime path.
3. Need live integration test to confirm FE payload uses Template Product id correctly when product does not yet exist in branch.
4. Need confirm BranchPrice after Quick Receive reflects runtime form prices, not only cloned template prices.
5. Need confirm product appears in branch Product List after commit.
