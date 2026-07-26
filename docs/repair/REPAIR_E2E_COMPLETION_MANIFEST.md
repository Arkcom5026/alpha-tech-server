# Repair / Warranty Claim E2E Completion Manifest

## Delivery identity

- Repository: `Arkcom5026/alpha-tech-server`
- Feature branch: `feature/service-asset-repair-e2e`
- Runtime owner: `src/modules/repair/`
- Canonical API base: `/api/repairs`
- Compatibility API base: `/api/repair`

## Mission boundary

This delivery establishes the backend ownership line for repair intake, diagnosis, estimate approval, authorized execution, actual part usage, completion readiness, settlement, customer handover, repair warranty, repeat repair, warranty claim, operational analytics, and management decision support.

The module owns its HTTP-to-Prisma flow through:

`HTTP -> repairRoutes -> repairController -> repair services -> repairRepository -> Prisma`

No controller-to-controller dependency is part of the intended runtime boundary.

## Actor authority

Read and intake authority:

- `OWNER`
- `MANAGER`
- `CASHIER`

Operational mutation authority:

- `OWNER`
- `MANAGER`

Every route is protected by token verification and repair employee context loading before role authorization.

## Operational lifecycle surface

### Intake and asset context

- `GET /intake-context/:lookup`
- `GET /customers/:customerId/warranty-assets`
- `POST /jobs`
- `GET /jobs`
- `GET /jobs/:id`

### Diagnosis and estimate

- `GET /jobs/:id/diagnoses`
- `POST /jobs/:id/diagnoses`
- `GET /jobs/:id/estimates`
- `POST /jobs/:id/estimates`
- `PATCH /jobs/:id/estimates/:estimateId/decision`

### Execution and parts

- `GET /jobs/:id/parts/summary`
- `POST /jobs/:id/parts`
- `POST /jobs/:id/parts/:partItemId/reversal`
- `GET /jobs/:id/cost-analytics`

### Completion, finance, and handover

- `GET /jobs/:id/completion-readiness`
- `PUT /jobs/:id/completion-checklist`
- `PATCH /jobs/:id/status`
- `GET /jobs/:id/financial-summary`
- `GET /jobs/:id/settlement`
- `POST /jobs/:id/payments`
- `GET /jobs/:id/invoices`
- `POST /jobs/:id/invoices`
- `POST /jobs/:id/handover`

### After-service and claims

- `GET /jobs/:id/repair-warranties`
- `POST /jobs/:id/repair-warranties`
- `POST /jobs/:id/repeat-repair-link`
- `GET /jobs/:id/asset-timeline`
- `GET /jobs/:id/repeat-failure-analytics`
- `POST /jobs/:id/warranty-claims`
- `GET /warranty-claims`
- `GET /warranty-claims/:claimId`
- `PATCH /warranty-claims/:claimId/status`

### Operational and management intelligence

- `GET /jobs/:id/operational-intelligence`
- `GET /dashboard`
- `GET /dashboard/risks`
- `GET /dashboard/decisions`
- `GET /dashboard/alerts`
- `GET /dashboard/brief`
- `GET /dashboard/executive-summary`

## Management projection contracts

- Operational intelligence
- Operational dashboard
- Operational risk
- Operational decision
- Management snapshot
- Management alert
- Daily management brief
- KPI snapshot
- Trend projection
- Executive summary
- Overall health score
- Health dimensions
- Priority focus

## Verification authority

### Gate A — Repository Gate

Repository completion is represented by:

- `npm run verify:repair-repository-gate`
- `npm run verify:repair-e2e-completion-audit`
- `npm run verify:repair-complete`

Gate A validates file ownership, route/controller/service exposure, contract tokens, server mounting, actor authorization wiring, milestone verifier registration, and final E2E command composition.

### Gate B — Runtime Gate

Gate B is deferred until the feature mission is repository-complete and the human performs the single final local synchronization. It must execute the complete verifier chain in the actual Node/Prisma environment.

Repository completion must never be reported as Runtime PASS.

### Gate C — Operational Gate

Gate C requires an actual authenticated flow against the running API and database. It validates observable behavior across intake, diagnosis, approval, execution, completion, settlement, handover, after-service, and management projections.

Repository completion must never be reported as Operational PASS.

## Delivery policy

- Repository-first continuous implementation
- One final local pull after repository mission completion
- Evidence-first runtime verification
- Targeted patch instead of broad rewrite
- Existing behavior preserved unless an approved repair contract explicitly changes it
- Files from unrelated tasks must not be introduced into this branch

## Current certification state

- Repository implementation: complete for the recorded scope
- Repository verification wiring: complete
- Runtime verification: deferred
- Operational verification: deferred

This manifest records scope and delivery intent. Runtime and operational certification remain evidence-dependent.
