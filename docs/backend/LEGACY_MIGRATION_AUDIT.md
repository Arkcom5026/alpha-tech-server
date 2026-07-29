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

## Workstream Order

### Batch A — Audit and Low-Risk Administration

Candidate domains:

- Unit
- Category
- Brand compatibility cleanup
- Product type / product type-brand
- Position
- Address
- Branch administration helpers

Goal: remove small, isolated legacy ownership first and establish exact remaining-file inventory.

### Batch B — Customer and Commerce Support

Candidate domains:

- Customer
- Cart
- Customer deposit
- Combined billing
- Online order
- Upload adapters

Goal: move support workflows without mixing them with sale/payment runtime already migrated.

### Batch C — Reports and Finance Remainders

Candidate domains:

- Sales report
- Purchase report
- Input-tax legacy report
- Tax report route compatibility
- Daily closing / finance compatibility aliases

Goal: consolidate read projections and remove duplicate root finance ownership.

### Batch D — Product Runtime Remainders

Candidate domains:

- Product profile
- Product runtime route/controller facade
- Barcode
- Branch price
- Template/type compatibility paths

Goal: complete product canonical ownership while preserving operational catalog behavior.

### Batch E — Stock and Procurement Core

Candidate domains:

- Stock dashboard
- Stock item
- Stock audit
- Purchase order
- Purchase order receipt
- Purchase order receipt item
- Simple receipt compatibility path

Goal: migrate the most coupled remaining workflows last, after lower-risk legacy surfaces are removed and current dependencies are clear.

## Safety Protocol Per Increment

1. Branch from latest `main`.
2. Create one Draft PR as the working area.
3. Identify current route mount and all imports/requires.
4. Define canonical module target.
5. Move one coherent workflow at a time.
6. Preserve endpoint and behavior contracts.
7. Switch runtime mount/import only after module ownership is complete.
8. Delete legacy files only after zero-reference evidence.
9. Review final diff scope.
10. Merge through GitHub-native merge with exact expected head SHA.
11. Runtime and Production verification remain separate user authority.

## Initial Audit Finding

The earlier estimate of 15–30 remaining files was too low. Repository search confirms that the root `controllers/` and `routes/` structure still contains several dozen legacy or hybrid files. The exact count will be refined during Batch A by classifying each file as:

- `ACTIVE_LEGACY`
- `HYBRID_ADAPTER`
- `MODULE_ALIAS`
- `DEAD_REFERENCE`
- `MODULE_CANONICAL`
- `JUSTIFIED_ROOT`

## Current Increment Scope

This first increment establishes the audit authority and begins Batch A. It does not claim that any runtime file is safe to delete until reference verification is complete.

## Verification Boundary

Repository planning and evidence only at this stage. No build, test, database, runtime, deployment, or Production success is inferred.
