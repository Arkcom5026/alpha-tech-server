# Backend Mission Map — P1 / alpha-tech-server

Status: ACTIVE BASELINE
Purpose: Explain how each Mission crosses System, Runtime, Domain, and Migration layers.

This document completes the Backend Boot Knowledge set:

```txt
SYSTEM_MAP.md
RUNTIME_MAP.md
DOMAIN_MAP_*.md
MIGRATION_MAP.md
MISSION_MAP.md
```

## 1. Mission-Centric Backend Doctrine

A P1 Mission is defined by an end-to-end operational workflow, not by technical layers.

Backend, Frontend, Database, Runtime, Testing, and Migration are implementation domains inside the same Mission.

Backend work is valid only when it advances the current operational workflow safely.

```txt
Mission
→ Workflow
→ Checkpoint
→ Runtime path
→ Domain files touched
→ Verification
→ Operational completion
```

## 2. How To Use This File

Before starting a backend assignment, identify:

```txt
Mission:
Workflow:
Current checkpoint:
Current blocker:
Runtime path:
Legacy files touched:
Module files touched:
Migration implication:
Verification required:
```

If these are unclear, stop and ask ROLE-ARCH.

## 3. Mission B — Product Template → Quick Receive → Ready In Branch

### Mission Goal

Allow a branch operator to add/receive a product from the Product Template catalog until it becomes usable in the branch runtime.

Mission B is complete only when this works end-to-end:

```txt
Template Search
→ Template Selection
→ Operational Product lookup/create/clone
→ BranchPrice ready
→ Stock intake
→ Product visible and usable in branch runtime
```

### Backend Runtime Path

Primary backend path now understood:

```txt
GET /api/products/template/search
→ src/modules/product/routes/templateProductSearchRoutes.js
→ templateProductSearchController
→ templateProductSearchService
→ productTemplateRepository
→ Template Product from T01

POST /api/quick-stock/existing
→ src/modules/quickStock/routes/quickStockRoutes.js
→ quickStockController.quickStockExistingReceive
→ QuickStockService.quickReceiveExistingProduct
→ productTemplateEngine.cloneProductFromTemplate if needed
→ BranchPrice runtime upsert
→ StockItem / SimpleLot write
→ StockMovement write
→ StockBalance upsert

GET /api/products/pos/search or Product List runtime
→ routes/productRoutes.js (compatibility mount only)
→ src/modules/product/routes/productModuleRoutes.js
→ Product-owned query/controller/service/repository slices
→ Operational Product visible in current branch
```

### Mission B Checkpoints

```txt
B-01 Template Search                 READY
B-02 Template Selection              READY
B-03 Operational Lookup              READY / FE prepared
B-04 Clone/Create Operational Product ENGINE EXISTS
B-05 BranchPrice Ready               CLONE DEFAULT + RUNTIME UPSERT EXISTS
B-06 Stock Intake                    QUICK RECEIVE RUNTIME EXISTS
B-07 End-to-End Runtime Verification NEXT
B-08 Mission Complete                WAITING FOR VERIFICATION
```

### Domains Crossed

```txt
Product Template Search
Product Template Engine
QuickStock
BranchPrice
StockItem / SimpleLot
StockMovement
StockBalance
Product Runtime List/Search
```

### Files Involved

Module-first / canonical:

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
src/modules/product/routes/templateProductSearchRoutes.js
src/modules/product/controllers/templateProductSearchController.js
src/modules/product/services/templateProductSearchService.js
src/modules/product/repositories/productTemplateRepository.js
src/modules/product/services/productTemplateEngine/
src/modules/quickStock/routes/quickStockRoutes.js
src/modules/quickStock/controllers/quickStockController.js
src/modules/quickStock/services/QuickStockService.js
```

Compatibility / adjacent runtime:

```txt
routes/productRoutes.js             compatibility mount only
routes/branchPriceRoutes.js         separate BranchPrice API surface
controllers/branchPriceController.js
routes/stockItemRoutes.js
controllers/stockItemController.js
```

Deprecated Product legacy implementation:

```txt
controllers/productController.js
```

This file has zero active Product route dependency after the Product Module Runtime cutover. It must not be restored as a runtime authority. Removal is permitted only after repository reference verification and dedicated deletion review.

### Migration Implication

Product runtime is now MODULE-CANONICAL.

```txt
routes/productRoutes.js
→ compatibility mount only
→ src/modules/product/routes/productModuleRoutes.js
→ Product-owned runtime slices
```

The backend already has a strong module-first runtime through QuickStock `/existing`.

Do not create a new parallel stock flow.

Do not restore Product runtime logic to `controllers/productController.js`.

BranchPrice and Stock remain separate domains and must be migrated only through their own workflow-driven assignments.

### Current Next Assignment

```txt
ASSIGNMENT-017 — Mission B End-to-End Runtime Verification
```

Verification target:

```txt
Template Search
→ select Template not yet in branch
→ Quick Receive commit through /api/quick-stock/existing
→ productTemplateEngine clones operational product if needed
→ BranchPrice reflects runtime form prices
→ stock runtime creates inventory
→ Product List / POS search shows product in current branch with price and stock
```

### Post-Verification Decisions

After B-07 passes, decide:

```txt
- Is /api/products/pos/create-from-template still needed?
- Should it be marked temporary compatibility endpoint?
- Can routes/productRoutes.js be replaced by a direct server mount in a later cleanup?
```

Legacy Product controller deletion is governed by repository reference verification, not by the old rule that Product must remain hybrid indefinitely.

## 4. Future Mission Mapping Template

Use this template for Mission C and beyond.

```txt
## Mission X — Name

### Mission Goal

### End-to-End Workflow

### Backend Runtime Path

### Checkpoints

### Domains Crossed

### Files Involved

### Migration Implication

### Current Next Assignment

### Post-Verification Decisions
```

## 5. Mission Assignment Rule

Every backend assignment must state how it advances a Mission checkpoint.

Bad assignment shape:

```txt
Refactor product controller
```

Good assignment shape:

```txt
Mission B / B-07
Verify QuickStock existing receive creates branch operational product, BranchPrice, and stock from Template selection.
No unrelated refactor allowed.
```

A migration assignment is valid when it removes a verified legacy authority without changing the operational contract.

## 6. Relationship To Other Maps

Read order:

```txt
SYSTEM_MAP.md      = What exists in backend
RUNTIME_MAP.md     = Mission B runtime path
DOMAIN_MAP_*.md    = Domain responsibility and behavior
MIGRATION_MAP.md   = Legacy/module migration rules
MISSION_MAP.md     = How Mission crosses all of the above
```

MISSION_MAP is the top-level workflow lens.

If MISSION_MAP conflicts with verified runtime evidence, update the stale document. Documentation must follow runtime truth; stale protection rules must not override a completed, verified cutover.

## 7. Living Document Rule

Update this file whenever:

```txt
- A new Mission starts.
- A Mission checkpoint changes.
- A runtime path is confirmed or replaced.
- A Mission crosses a new domain.
- A verification report changes the workflow status.
- A compatibility endpoint becomes deprecated.
- A module becomes canonical and legacy protection rules become stale.
```
