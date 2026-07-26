# Alpha-Tech Tax Platform — Backend Execution Authority

## Mission

Build the Alpha-Tech Tax Platform as an independent tax authority layer for Sales, Purchase, Repair, Expense, Returns, Claims, and future business modules.

This branch is the dedicated backend delivery line for the mission:

- Branch: `feature/tax-platform-authority`
- Base: `main`
- Repository: `Arkcom5026/alpha-tech-server`

## Source of Truth

1. Current repository runtime and contracts
2. Current Prisma schema and migrations
3. Tax Step Packages STEP 001–180
4. Runtime evidence produced from the user's local environment

When the Step Packages conflict with the current runtime, preserve existing behavior first, then introduce the tax authority through isolated slices.

## Architectural Boundary

Business modules own:

- commercial transaction intent
- pricing and discount
- payment and fulfillment
- repair, purchase, expense, return, and claim workflow

Tax owns:

- tax eligibility and classification
- official tax document numbering
- immutable issuer, customer, supplier, address, and line snapshots
- tax document lifecycle
- tax ledger
- input/output VAT reporting
- tax periods, locking, closing, submission, evidence, cancellation, replacement, credit notes, and debit notes

Issued tax records must not depend on mutable live master data.

## Delivery Strategy

The 180 steps are executed as traceable capability slices rather than 180 tightly coupled deployments.

### Phase A — Tax Foundation

- authority contracts and policies
- tax candidate intake
- validation and classification
- tax document aggregate
- immutable snapshots
- numbering authority

### Phase B — Tax Ledger and Reporting

- tax ledger entries
- input/output VAT projections
- reconciliation
- tax periods and locking
- close and reopen controls

### Phase C — Document Lifecycle

- issue, cancel, replace
- credit note and debit note
- return and correction integration
- print/export projections

### Phase D — Filing and Settlement

- filing batches
- submission evidence
- payment/refund/settlement lifecycle
- archive and audit trail

### Phase E — Operations and Governance

- monitoring and recovery
- data quality and exception management
- permissions, security, continuity
- release, support, training, compliance, and long-term governance

STEP 121–180 are treated primarily as recurring operational and governance controls rather than one-time feature dependencies.

## Prisma Boundary

The assistant may design and prepare Prisma changes, contracts, migration notes, and integration patches. Prisma generate, migration creation/application, database verification, and runtime certification are performed by the user locally.

Required handoff format for every Prisma slice:

1. exact schema changes
2. migration intent and invariants
3. local commands
4. expected verification evidence
5. commit and push instructions
6. backend continuation point after the pushed commit is verified

No Prisma-dependent slice advances to Runtime PASS until the user's pushed commit and local evidence are available.

## Gates

- Gate A — Repository: architecture, contracts, exports, route wiring, static review, diff scope
- Gate B — Runtime: install, Prisma generate/migrate, tests, lint, build, database checks
- Gate C — Operational: FE → API → application → Prisma → DB → projection → report/document flow

Repository PASS is not Runtime PASS. Runtime PASS is not Operational PASS.

## Initial Execution Order

1. Inventory existing tax-related schema, services, controllers, routes, documents, and reports
2. Freeze compatibility contracts for Sale and Purchase receipt flows
3. Introduce tax module skeleton and public contracts without changing runtime behavior
4. Prepare Prisma Tax Foundation slice for local execution
5. Continue backend application and API slices after Prisma commit verification
6. Coordinate frontend implementation on the matching client branch

## Completion Rule

The mission is complete only when:

- tax authority owns tax lifecycle and immutable records
- existing Sales/Purchase/Repair workflows remain operational
- input/output VAT reports reconcile to the ledger
- tax periods can be controlled and audited
- document corrections are traceable
- local Runtime and Operational gates pass
- governance material required for actual operation is delivered
