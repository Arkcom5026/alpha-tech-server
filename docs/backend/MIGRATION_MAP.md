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
→ Make legacy controller thinner over time
→ Keep every intermediate state deployable
```

Do not move code just because it is old.

Do not delete code just because a new module exists.

Do not perform broad rewrite while a workflow is still being recovered or verified.

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
- Which legacy entrypoint currently serves production?
- Which module capability already exists?
- Is this a feature patch, verification patch, or migration patch?
- What must not be refactored?
- What is the rollback risk?
```

## 3. Migration Stages

Use these labels in assignments and reports.

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
Legacy path has zero runtime dependency and can be deprecated or removed through a dedicated deletion assignment.
```

## 4. Global Safe Migration Protocol

For every migration:

```txt
1. Identify active workflow.
2. Identify current production entrypoint.
3. Identify canonical target module.
4. Search references/imports.
5. Redirect one call path at a time.
6. Verify runtime behavior.
7. Update docs.
8. Only then consider deleting legacy code.
```

Deletion requires explicit proof:

```txt
- zero runtime imports/requires
- no route mounted
- no script/test dependency
- no frontend call depends on old endpoint
- verification report committed
- ROLE-ARCH approval
```

## 5. Domain Migration Matrix

## Product Domain

### Current Stage

```txt
HYBRID
```

### Production Entry

```txt
server.js
→ /api/products
→ routes/productRoutes.js
→ controllers/productController.js
```

### Module Entry / Target

```txt
src/modules/product/
  controllers/
  repositories/
  routes/
  services/
```

### Canonical Runtime Pieces

```txt
Template Search:
src/modules/product/routes/templateProductSearchRoutes.js
src/modules/product/controllers/templateProductSearchController.js
src/modules/product/services/templateProductSearchService.js
src/modules/product/repositories/productTemplateRepository.js

Template Clone:
src/modules/product/services/productTemplateEngine/
```

### Legacy Runtime Pieces

```txt
routes/productRoutes.js
controllers/productController.js
src/modules/product/services/productCloneService.js
```

### Current Understanding

Product runtime must follow Runtime Catalog Separation:

```txt
Template Catalog = QuickStock search and clone source only
Operational Product Catalog = branch runtime surfaces only
```

Operational product branch isolation usually uses:

```txt
product.productType.branchId = req.user.branchId
```

### Safe Migration Direction

```txt
routes/productRoutes.js remains production entrypoint
controllers/productController.js becomes adapter over time
productTemplateEngine remains canonical clone engine
Product search/runtime mapping should gradually move into module services
```

### Protected / Do Not Delete

```txt
routes/productRoutes.js
controllers/productController.js
src/modules/product/services/productCloneService.js
```

The legacy clone service may be duplicate, but do not delete until dependency verification proves zero runtime dependency.

### Next Migration Opportunities

```txt
- Move route-local create-from-template handler out of routes/productRoutes.js.
- Decide whether /api/products/pos/create-from-template is still needed after QuickStock /existing verification.
- Extract mapRuntimeProductForPos into module mapper when Product runtime is touched again.
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
src/modules/stock/           (future target, not yet canonical)
src/modules/inventory/       (possible future target if chosen by architecture)
```

### Current Understanding

Stock runtime is shared by multiple workflows:

```txt
QuickStock receive
PO Receipt receive/commit
Sales createSale
Stock Dashboard
Stock Audit
```

Core models:

```txt
StockItem
SimpleLot
StockBalance
StockMovement
BarcodeReceiptItem
```

### Safe Migration Direction

Do not start Stock migration as a standalone cleanup project.

Migrate only when a workflow touching stock requires change.

Preferred future extraction:

```txt
StockMutationService
StockBalanceService
StockMovementService
StockProjectionService
```

### Protected / Do Not Delete

```txt
routes/stockRoutes.js
controllers/stockController.js
routes/stockItemRoutes.js
controllers/stockItemController.js
```

### Next Migration Opportunities

```txt
- Extract stock balance upsert logic when repeated across QuickStock, PO Receipt, and Sales.
- Extract StockMovement write helpers when stock movement behavior is standardized.
- Keep dashboard read-only as projection surface.
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

### Current Understanding

This domain is the clearest example of approved incremental migration:

```txt
One endpoint moved to module
Remaining endpoints stay legacy
Route remains stable
No rewrite
```

### Safe Migration Direction

```txt
routes/purchaseOrderRoutes.js remains stable facade
Move one operation at a time into src/modules/procurement
Keep endpoint contracts stable for FE
```

### Protected / Do Not Delete

```txt
routes/purchaseOrderRoutes.js
controllers/purchaseOrderController.js
controllers/purchaseOrderReceiptController.js
src/modules/procurement/controllers/procurementController.js
src/modules/procurement/services/purchaseOrderService.js
```

### Next Migration Opportunities

```txt
- Move createPurchaseOrder only when PO create workflow is being actively changed.
- Move update/status flow only when status lifecycle is being fixed.
- Do not mix PO migration with QuickStock Mission B unless directly required.
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

### Related Controller

```txt
controllers/purchaseOrderReceiptItemController.js
```

### Current Understanding

PO Receipt coordinates formal receiving:

```txt
PurchaseOrderReceipt
PurchaseOrderReceiptItem
BarcodeReceiptItem
StockItem / SimpleLot
StockBalance
Supplier payable / credit
Finalize / commit
Barcode print status
```

### Safe Migration Direction

Move receipt runtime only when formal PO receiving workflow is being improved.

Do not merge QuickStock and PO Receipt yet.

They can share lower-level helpers later.

### Protected / Do Not Delete

```txt
routes/purchaseOrderReceiptRoutes.js
controllers/purchaseOrderReceiptController.js
controllers/purchaseOrderReceiptItemController.js
```

### Next Migration Opportunities

```txt
- Extract barcode generation service.
- Extract receipt commit service.
- Share stock mutation helpers with QuickStock after both flows are verified.
```

## Sales Domain

### Current Stage

```txt
HYBRID
```

### Production Entry

```txt
/api/sales
/api/sale-orders  (backward compatibility)
→ routes/saleRoutes.js
→ controllers/saleController.js
```

### Module Pieces Already Used

```txt
src/modules/sales/contracts/saleDocument.include.js
src/modules/sales/services/saleDocument.service.js
```

### Current Understanding

Sales controller is still the main production runtime.

It handles:

```txt
Sale validation
Money/VAT validation
StockItem availability
Sale creation
StockItem SOLD update
StockMovement SALE rows
Payment optional autocreate
Document line update through module service
```

### Safe Migration Direction

Do not rewrite saleController broadly.

Move document-specific logic first because module service already exists.

Move stock mutation into shared Stock service only after stock helper is canonical.

### Protected / Do Not Delete

```txt
routes/saleRoutes.js
controllers/saleController.js
src/modules/sales/contracts/saleDocument.include.js
src/modules/sales/services/saleDocument.service.js
```

### Next Migration Opportunities

```txt
- Extract SaleStockService when stock mutation helpers are ready.
- Extract SaleMoneyValidation only when sale pricing/tax workflow is being changed.
- Keep /api/sale-orders alias until FE/backward dependency is verified zero.
```

## BranchPrice Domain

### Current Stage

```txt
LEGACY / SHARED RUNTIME
```

### Production Entry

```txt
/api/branch-prices
→ routes/branchPriceRoutes.js
→ controllers/branchPriceController.js
```

### Current Understanding

BranchPrice is shared by Product, QuickStock, Online/POS product search, and pricing management.

Runtime Branch Price Contract:

```txt
Source of Truth for Quick Receive = Quick Receive Runtime Session
Required = productId, costPrice, priceRetail
Optional = priceWholesale, priceTechnician, priceOnline
Queue item must never contain pricing
```

### Safe Migration Direction

Do not move BranchPrice during Mission B verification.

If repeated price upsert logic appears, extract a module service later:

```txt
src/modules/pricing/services/branchPriceService.js
```

or

```txt
src/modules/product/services/branchPriceRuntimeService.js
```

Architecture decision required before choosing final module location.

### Protected / Do Not Delete

```txt
routes/branchPriceRoutes.js
controllers/branchPriceController.js
```

## Auth / Employee Context

### Current Stage

```txt
HYBRID CONTEXT
```

### Current Canonical Source

```txt
middlewares/verifyToken.js
→ req.user
```

### New/Hybrid Context

Some module guards support:

```txt
req.employee
```

But `verifyToken.js` currently creates `req.user`, not guaranteed `req.employee`.

### Safe Migration Direction

New module code must use fallback pattern:

```js
const branchId = req.employee?.branchId || req.user?.branchId
const employeeId = req.employee?.id || req.user?.employeeId || req.user?.id
```

Do not assume `req.employee` exists unless assigned middleware creates it.

### Next Migration Opportunities

```txt
- Create a shared employee-context middleware if repeated guards diverge.
- Standardize req.employee only through a dedicated auth/context assignment.
```

## 6. Mission B Migration State

Mission B currently should not trigger more migration before end-to-end verification.

Current best path:

```txt
/api/products/template/search
→ /api/quick-stock/existing
→ productTemplateEngine clone if needed
→ BranchPrice runtime upsert
→ Stock runtime writes
→ Product visible in branch runtime
```

Migration status for Mission B:

```txt
Template Search: MODULE-FIRST
QuickStock Commit: MODULE-FIRST
Product Clone: MODULE-CANONICAL inside productTemplateEngine
Product Operational Search: LEGACY/HYBRID via productController
BranchPrice: LEGACY shared runtime
Stock write: MODULE-FIRST through QuickStock, shared legacy concepts/models
Product List visibility: LEGACY via productController
```

Next Mission B step:

```txt
ASSIGNMENT-017 — End-to-End Runtime Verification
```

Not another implementation or migration patch.

## 7. Assignment Template Requirement

Every backend assignment must include this block:

```txt
Migration Classification:
- Stage:
- Production entrypoint:
- Module target:
- Workflow checkpoint:
- Files allowed:
- Files forbidden:
- Refactor allowed: YES/NO
- Deletion allowed: YES/NO
- Verification report path:
```

If the assignment lacks this block, the receiving Task must pause and ask ROLE-ARCH.

## 8. Living Document Rule

Update this file whenever:

```txt
- A legacy endpoint moves to module runtime.
- A module becomes canonical.
- A legacy file becomes deletion candidate.
- A dependency search proves a file is unused.
- A workflow chooses a new canonical path.
- A backward-compatible alias is removed.
```

This file is part of backend boot knowledge and must stay current.
