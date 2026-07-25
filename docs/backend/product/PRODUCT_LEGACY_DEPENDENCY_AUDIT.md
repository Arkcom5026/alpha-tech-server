# Product Legacy Dependency Audit

Status: ACTIVE — Batch E Legacy Retirement
Branch: `refactor/product-backend-reference-module`
PR: #8

## Purpose

Record the repository evidence required before deleting transitional Product files. This audit is structural only; runtime and operational verification remain deferred until the consolidated migration gate.

## Current Runtime Composition

`server.js` now mounts Product through a single module boundary:

```text
server.js
→ src/modules/product/index.js
→ capability-owned routes
```

The module composer currently owns these public mounts without changing paths:

```text
/api/products/template
/api/products/trace
/api/products
/api/quick-stock
/api/product-create
```

## Legacy Candidate Classification

### Candidate A — `controllers/productController.js`

Current production `routes/productRoutes.js` no longer imports this controller. Every mounted Product endpoint now delegates to a capability owner:

- catalog
- create
- runtime
- readyToSell
- duplicatePreview
- maintenance
- pricing
- media
- lifecycle
- stockModeMigration
- templateClone

Repository code search still finds historical/documentation/tool references to the file, so deletion must wait until those references are classified and any required compatibility tooling is updated. The file is no longer a production route owner.

Classification:

```text
RUNTIME OWNER: NO
DELETE NOW: NO
NEXT ACTION: inspect historical/tool references, then delete in a dedicated retirement commit
```

### Candidate B — `controllers/productPriceController.js`

The file is absent on the current feature branch. Product pricing routes now use `product/pricing` directly and the optional require plus `501 NOT_IMPLEMENTED` fallback has been removed.

Classification:

```text
RUNTIME OWNER: NO
CURRENT BRANCH STATUS: ABSENT
NEXT ACTION: no deletion required; retain repository evidence in this audit
```

### Candidate C — Product root runtime layers

Transitional root paths include:

```text
src/modules/product/controllers/
src/modules/product/services/
src/modules/product/repositories/
src/modules/product/routes/
```

Known compatibility boundaries still exist, including Runtime service/repository adapters used by capability wrappers. These must not be deleted until implementation ownership is moved or imports are rewired.

Classification:

```text
RUNTIME OWNER: PARTIAL / COMPATIBILITY
DELETE NOW: NO
NEXT ACTION: migrate implementation behind product/runtime and templateClone, then re-run import audit
```

### Candidate D — Template clone implementations

Multiple historical clone implementations exist under Product services. The public clone endpoint now has a `product/templateClone` transport owner, but its service still delegates to existing runtime clone logic. Duplicate clone engines must be compared before any removal.

Classification:

```text
RUNTIME OWNER: TEMPLATE CLONE CAPABILITY AT TRANSPORT LAYER
IMPLEMENTATION OWNER: TRANSITIONAL
DELETE NOW: NO
NEXT ACTION: normalize one clone engine and retire duplicates only after contract comparison
```

## Production Route Ownership Result

The central Product route file no longer depends on `controllers/productController.js`. The remaining root route file is a composition surface only; workflow ownership resides in capability modules.

```text
Complete mounted endpoint ownership: PASS
Legacy controller production ownership: RETIRED
Legacy implementation retirement: IN PROGRESS
```

## Safety Decision

No destructive deletion is performed in this audit commit. Repository search results include documentation and tooling references, while compatibility imports remain under Product root runtime layers. Deletion before resolving those references would violate the migration safety rule.

## Next Repository Step

Normalize the runtime implementation boundary by replacing `product/runtime` compatibility re-exports with capability-owned implementation files, beginning with the repository and service pair. Then re-run reference search and delete only files proven unreachable from production and verification tooling.
