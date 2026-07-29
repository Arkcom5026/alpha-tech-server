# Legacy Migration Audit — Finalization Agenda

## Status

ACTIVE WORKING BASELINE

## Mission

Close the remaining backend structure migration from root type-based ownership into feature-owned module runtime without redesigning business behavior.

This audit is the working authority for the remaining migration increments. It replaces rough estimates with repository evidence and keeps each migration deployable.

## Repository Evidence Baseline

Current `main` still contains multiple active root-level controllers and routes. Representative legacy surfaces discovered include:

- Product and catalog administration
- Stock and stock-item runtime
- Procurement and formal purchase receipts
- Employee, position, branch, and address administration
- Customer, cart, online order, deposit, billing, and reporting surfaces
- Tax and upload adapters

Existing module-owned runtime also exists in parallel for several domains, so remaining work must distinguish:

- Active legacy runtime
- Hybrid adapter runtime
- Duplicate or compatibility aliases
- Dead/reference-only files
- Module-canonical runtime

## Completion Definition

The migration agenda is complete only when:

1. Every active production route has one explicit canonical owner.
2. Root controller/route files are removed where module ownership is complete.
3. Remaining root files have a documented architectural reason to remain.
4. No deleted file has runtime, script, test, or compatibility dependency.
5. `server.js` mounts canonical module routes wherever ownership has migrated.
6. Public endpoints, HTTP methods, authorization behavior, response contracts, and business results remain compatible unless separately approved.
7. Repository evidence is recorded independently from runtime and Production evidence.

## Runtime-First Priority Order

The agenda now prioritizes files by production runtime impact rather than by apparent simplicity.

### Priority 1 — Transactional Core

- Purchase order
- Purchase receipt
- Purchase receipt item
- Stock mutation and stock item runtime
- Barcode generation and receipt finalization
- Product operational runtime

### Priority 2 — Commerce Workflows

- Customer
- Cart
- Online order
- Customer deposit
- Combined billing

### Priority 3 — Financial and Reporting Surfaces

- Sales report
- Purchase report
- Input-tax legacy report
- Finance compatibility aliases

### Priority 4 — Supporting Administration

- Unit
- Category
- Brand compatibility cleanup
- Product type / product type-brand
- Position
- Address
- Branch administration helpers

This order intentionally handles high-impact runtime ownership first and leaves relatively static reference-data administration until later.

## Current Runtime Increment — Procurement Route Ownership

The first runtime-first increment moved these production route owners into the procurement module:

- `src/modules/procurement/purchase-order/routes/purchaseOrderRoutes.js`
- `src/modules/procurement/receipt/routes/purchaseOrderReceiptRoutes.js`
- `src/modules/procurement/receipt/routes/purchaseOrderReceiptItemRoutes.js`

`server.js` now mounts those module routes directly while preserving the same public endpoints:

- `/api/purchase-orders`
- `/api/purchase-order-receipts`
- `/api/purchase-order-receipt-items`

Removed root route files:

- `routes/purchaseOrderRoutes.js`
- `routes/purchaseOrderReceiptRoutes.js`
- `routes/purchaseOrderReceiptItemRoutes.js`

This increment changes route ownership only. Existing controllers, HTTP methods, middleware, endpoint paths, request adaptation, and response behavior were carried forward without intentional redesign.

## Remaining Workstreams

### Runtime Batch A — Stock and Procurement Core

Candidate domains:

- Stock dashboard
- Stock item
- Stock audit
- Remaining purchase-order compatibility files
- Remaining purchase-receipt compatibility files
- Simple receipt compatibility path

Goal: complete ownership of the most coupled inventory and procurement workflows.

### Runtime Batch B — Product Runtime Remainders

Candidate domains:

- Product profile
- Product runtime facade
- Barcode
- Branch price
- Template/type compatibility paths

Goal: complete product canonical ownership while preserving operational catalog behavior.

### Runtime Batch C — Customer and Commerce Support

Candidate domains:

- Customer
- Cart
- Customer deposit
- Combined billing
- Online order
- Upload adapters

Goal: move active support workflows without mixing them with sale/payment runtime already migrated.

### Runtime Batch D — Reports and Finance Remainders

Candidate domains:

- Sales report
- Purchase report
- Input-tax legacy report
- Tax report route compatibility
- Daily closing / finance compatibility aliases

Goal: consolidate projections and remove duplicate root finance ownership.

### Final Batch — Supporting Administration

Candidate domains:

- Unit
- Category
- Brand compatibility cleanup
- Product type / product type-brand
- Position
- Address
- Branch administration helpers

Goal: remove remaining low-risk reference-data ownership after transactional runtime is canonical.

## Safety Protocol Per Increment

1. Work on the existing Draft PR branch for this agenda.
2. Identify current route mount and all imports/requires.
3. Define canonical module target.
4. Move one coherent workflow at a time.
5. Preserve endpoint and behavior contracts.
6. Switch runtime mount/import only after module ownership is complete.
7. Delete legacy files only after the runtime mount has moved and no additional repository reference is identified.
8. Review final diff scope.
9. Merge through GitHub-native merge with exact expected head SHA.
10. Runtime and Production verification remain separate user authority.

## Audit Classification

Every remaining root file will be classified as one of:

- `ACTIVE_LEGACY`
- `HYBRID_ADAPTER`
- `MODULE_ALIAS`
- `DEAD_REFERENCE`
- `MODULE_CANONICAL`
- `JUSTIFIED_ROOT`

## Verification Boundary

Repository migration evidence only. No build, test, database, runtime, deployment, or Production success is inferred until separately verified.
