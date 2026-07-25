# Backend Migration Map — P1 / alpha-tech-server

Status: ACTIVE BASELINE
Purpose: Boot knowledge for future Tasks before touching backend architecture.

This document explains how P1 backend should move from legacy runtime to new module runtime without breaking live workflows.

It does not replace:

```txt
SYSTEM_MAP.md   = whole backend structure
RUNTIME_MAP.md  = Mission B runtime path
DOMAIN_MAP_*    = domain-level behavior
```

It answers:

```txt
What is legacy?
What is canonical?
Which runtime path is active?
Which files are safe to touch?
Which files must not be deleted yet?
How should migration happen?
```

## 1. Core Migration Doctrine

P1 backend migration is workflow-driven, not cleanup-driven.

Approved direction:

```txt
Understand the workflow
→ Identify legacy files touched by that workflow
→ Map responsibility
→ Reuse or create module capability only when safe
→ Cut over runtime after capability coverage
→ Verify repository references
→ Remove legacy in a dedicated assignment
→ Keep every intermediate state deployable
```

Do not move code just because it is old.

Do not delete code merely because a new module exists.

Do not keep stale legacy protection rules after verified runtime evidence proves the module is canonical.

## 2. Backend Migration Boot Rule

Every backend Task must boot in this order before code changes:

```txt
1. Read docs/backend/SYSTEM_MAP.md
2. Read docs/backend/RUNTIME_MAP.md if working Mission B or Product/QuickStock runtime
3. Read relevant DOMAIN_MAP_*.md if touching Stock / Procurement / Sales
4. Read docs/backend/MIGRATION_MAP.md
5. Read the assigned files only after understanding the workflow and migration stage
```

Before writing code, the Task must be able to answer:

```txt
- Which workflow is being advanced?
- Which entrypoint currently serves production?
- Which module capability already exists?
- Is this a feature patch, verification patch, migration patch, or deletion patch?
- What must not be refactored?
- What is the rollback risk?
```

## 3. Migration Stages

### LEGACY

```txt
Production route/controller/service still lives outside src/modules.
No reliable module replacement exists yet.
```

Allowed:
- Minimal production fix.
- Add guard or validation.
- Add report/map.

Forbidden:
- Large refactor.
- File deletion.
- Moving unrelated logic.

### HYBRID

```txt
Legacy route/controller remains production entrypoint.
Some responsibility has moved to src/modules.
Legacy code may call module services.
```

Preferred shape:

```txt
Legacy Route
→ Legacy Controller as Adapter
→ Module Service / Runtime Engine
→ Repository / Prisma Access
```

### MODULE-FIRST

```txt
Module route/controller/service is the main runtime path.
Legacy route may remain as backward-compatible alias.
```

### MODULE-CANONICAL

```txt
Module implementation is the canonical runtime.
Legacy implementation has zero active runtime authority.
Compatibility mounts may remain temporarily.
Legacy files may be removed through a dedicated deletion assignment after verification.
```

## 4. Global Safe Migration Protocol

For every migration:

```txt
1. Identify active workflow.
2. Identify current production entrypoint.
3. Identify canonical target module.
4. Search references/imports.
5. Redirect one call path at a time.
6. Verify repository state and runtime evidence separately.
7. Update docs and stale protection rules.
8. Only then consider deleting legacy code.
```

Deletion requires explicit proof:

```txt
- zero runtime imports/requires
- no legacy route mounted as authority
- no script/test dependency that mutates or imports the legacy file
- no frontend call depends on a removed endpoint
- verification evidence committed or recorded
- ROLE-ARCH approval
```

Historical documentation references do not count as runtime dependencies, but stale docs must be updated before deletion so they do not restore obsolete authority.

## 5. Domain Migration Matrix

## Product Domain

### Current Stage

```txt
MODULE-CANONICAL
```

### Production Entry

```txt
server.js
→ /api/products
→ routes/productRoutes.js                 compatibility mount only
→ src/modules/product/routes/productModuleRoutes.js
→ Product-owned capability slices
```

### Canonical Runtime Pieces

```txt
Product Router:
src/modules/product/routes/productModuleRoutes.js

Query:
src/modules/product/query/

Create:
src/modules/product/create/

Update:
src/modules/product/update/

Status / Lifecycle:
src/modules/product/status/

Delete Policy:
src/modules/product/delete/

Image Delete:
src/modules/product/imageDelete/

Pricing:
src/modules/product/pricing/

Migrate To Simple:
src/modules/product/migrateToSimple/

Template Search:
src/modules/product/routes/templateProductSearchRoutes.js
src/modules/product/controllers/templateProductSearchController.js
src/modules/product/services/templateProductSearchService.js
src/modules/product/repositories/productTemplateRepository.js

Template Clone:
src/modules/product/services/productTemplateEngine/
```

### Compatibility Pieces

```txt
routes/productRoutes.js
```

This file may remain as a stable server wiring alias. It must contain no Product business logic and must only export the module router.

### Deprecated Legacy Pieces

```txt
controllers/productController.js
tools/apply-mission-b-controller-adapter-fix.js
ffff
```

`controllers/productController.js` has no active Product route dependency after cutover.

`tools/apply-mission-b-controller-adapter-fix.js` is obsolete because it rewrites a deprecated controller and could accidentally restore legacy authority.

`ffff` is historical diff evidence and must not be treated as executable authority.

### Current Understanding

Product runtime must follow Runtime Catalog Separation:

```txt
Template Catalog = QuickStock search and clone source only
Operational Product Catalog = branch runtime surfaces only
```

Operational Product branch isolation uses:

```txt
product.productType.branchId = current branchId
```

### Safe Migration Direction

```txt
Keep routes/productRoutes.js as compatibility mount while server wiring remains unchanged.
Keep productModuleRoutes.js as canonical route authority.
Do not restore logic to controllers/productController.js.
Delete obsolete patch tools and historical accidental artifacts after reference verification.
Remove controllers/productController.js only in a dedicated legacy-removal commit.
Keep productTemplateEngine as canonical clone engine.
```

### Protected / Do Not Delete

```txt
src/modules/product/routes/productModuleRoutes.js
src/modules/product/query/
src/modules/product/create/
src/modules/product/update/
src/modules/product/status/
src/modules/product/delete/
src/modules/product/imageDelete/
src/modules/product/pricing/
src/modules/product/migrateToSimple/
src/modules/product/services/productTemplateEngine/
routes/productRoutes.js   while server.js imports this compatibility path
```

`controllers/productController.js` is no longer protected by architecture doctrine. Its deletion is blocked only until repository cleanup and final verification complete.

### Next Migration Steps

```txt
1. Remove obsolete Product controller patch tool.
2. Remove accidental historical diff artifact if confirmed non-runtime.
3. Repeat repository-wide reference verification.
4. Remove controllers/productController.js in a dedicated commit.
5. Preserve routes/productRoutes.js compatibility mount unless server mount is separately changed.
```

## QuickStock Domain

### Current Stage

```txt
MODULE-FIRST
```

### Production Entry

```txt
server.js
→ /api/quick-stock
→ src/modules/quickStock/routes/quickStockRoutes.js
```

### Canonical Runtime

```txt
src/modules/quickStock/controllers/quickStockController.js
src/modules/quickStock/services/QuickStockService.js
```

### Reference / Legacy-like Files

```txt
src/modules/quickStock/services/QuickStockService_Runtime_SafeTransaction.js
src/modules/product/services/productTemplateEngine/QuickStockService.js
src/modules/product/services/productTemplateEngine/QuickStockService_auto_clone_patch.js
```

These may contain useful historical logic but must not be treated as canonical unless verified.

### Current Understanding

Main Mission B candidate:

```txt
POST /api/quick-stock/existing
→ quickStockController.quickStockExistingReceive
→ QuickStockService.quickReceiveExistingProduct
→ productTemplateEngine.cloneProductFromTemplate if needed
→ BranchPrice upsert
→ StockItem / SimpleLot
→ StockMovement
→ StockBalance
```

### Safe Migration Direction

QuickStock is already mostly inside new module runtime.

Do not move it back into legacy controllers.

Do not split QuickStock into multiple new APIs unless workflow verification proves the current path is insufficient.

### Protected / Do Not Delete

```txt
src/modules/quickStock/services/QuickStockService.js
src/modules/quickStock/controllers/quickStockController.js
src/modules/quickStock/routes/quickStockRoutes.js
```

### Next Migration Opportunities

```txt
- Verify /existing end-to-end.
- Mark old/reference QuickStockService files as legacy/reference after dependency search.
- Extract reusable stock mutation helpers only when another workflow needs them.
```

## Stock Domain

### Current Stage

```txt
LEGACY / HYBRID-READY
```

### Production Entries

```txt
/api/stock/dashboard
→ routes/stockRoutes.js
→ controllers/stockController.js

/api/stock-items
→ routes/stockItemRoutes.js
→ controllers/stockItemController.js
```

### Canonical Runtime Today

```txt
controllers/stockController.js
controllers/stockItemController.js
```

### Migration Target

```txt
src/modules/stock/           future target, not yet canonical
src/modules/inventory/       possible future target if chosen by architecture
```

### Safe Migration Direction

Do not start Stock migration as a standalone cleanup project.

Migrate only when a workflow touching stock requires change.

### Protected / Do Not Delete

```txt
routes/stockRoutes.js
controllers/stockController.js
routes/stockItemRoutes.js
controllers/stockItemController.js
```

## Procurement / Purchase Order Domain

### Current Stage

```txt
HYBRID
```

### Production Entry

```txt
/api/purchase-orders
→ routes/purchaseOrderRoutes.js
```

### Current Split

```txt
getAllPurchaseOrders
→ src/modules/procurement/controllers/procurementController.js
→ src/modules/procurement/services/purchaseOrderService.js

Other PO operations
→ controllers/purchaseOrderController.js

Receipt helper endpoints
→ controllers/purchaseOrderReceiptController.js
```

### Safe Migration Direction

```txt
routes/purchaseOrderRoutes.js remains stable facade
Move one operation at a time into src/modules/procurement
Keep endpoint contracts stable for FE
```

## Purchase Receipt Domain

### Current Stage

```txt
LEGACY / HYBRID-READY
```

### Production Entry

```txt
/api/purchase-order-receipts
→ routes/purchaseOrderReceiptRoutes.js
→ controllers/purchaseOrderReceiptController.js
```

Move receipt runtime only when formal PO receiving workflow is being improved.

Do not merge QuickStock and PO Receipt yet.

## Sales Domain

### Current Stage

```txt
HYBRID
```

Sales migration remains workflow-driven and is not changed by Product becoming MODULE-CANONICAL.

## 6. Doctrine Conflict Resolution

When a document says “do not delete” but verified runtime and dependency evidence show the old authority is no longer active:

```txt
Runtime truth wins
→ update the stale rule
→ preserve any still-active compatibility facade
→ repeat zero-reference verification
→ delete only the obsolete implementation
```

Do not confuse:

```txt
Compatibility path still mounted
```

with:

```txt
Legacy implementation still authoritative
```

For Product, `routes/productRoutes.js` remains mounted as a compatibility path, while `controllers/productController.js` is no longer authoritative.

## 7. Verification Boundaries

Repository verification may prove:
- route wiring
- imports/requires
- public exports
- stale docs/tools
- commit ancestry

Repository verification does not prove:
- npm/build success
- Prisma generation/migration
- database behavior
- HTTP runtime behavior
- operational end-to-end behavior

Those require Runtime Gate and Operational Gate evidence separately.
