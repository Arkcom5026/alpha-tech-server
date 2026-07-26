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

## Contract and boundary authority

The final contract and boundary audit is registered as:

- `npm run verify:repair-contract-boundary-audit`

It enforces the following repository invariants:

- Routes depend on controllers and authorization middleware, not services, repositories, or Prisma directly.
- Controllers delegate to feature services and must not access repositories or Prisma directly.
- Services must not depend on controllers, routes, or HTTP authorization middleware.
- The Repair repository must not depend upward on services, controllers, or routes.
- Direct Prisma access in `repairAuthorization.js` is an explicit infrastructure exception used only to establish trusted employee and branch context before runtime authorization.
- Mutation routes must carry an approved role policy. Intake creation and warranty-claim intake retain their explicitly approved intake authority; other operational mutations require `OWNER` or `MANAGER`.
- Repair failures remain typed through `RepairError`, `RepairFailureCode`, HTTP status, and optional details.

## Module isolation authority

The module isolation audit is registered as:

- `npm run verify:repair-module-isolation`

Its repository rules are:

- Repair source files must not import another feature module under `src/modules/*` directly.
- Repair must not import legacy controllers, routes, or services outside its own module boundary.
- Cross-domain Product, Stock, Customer, Supplier, Sale, and Employee data is read or mutated through Prisma relations owned by `repairRepository.js`; ownership is not transferred to another module controller or service.
- Direct Prisma ownership is restricted to `repairRepository.js` and the approved employee-context boundary in `repairAuthorization.js`.
- Any future change to those direct Prisma owners must be an explicit architecture decision rather than an accidental import.

## API response integrity authority

The API contract integrity audit is registered as:

- `npm run verify:repair-api-contract-integrity`

Its repository rules are:

- Every exposed route resolves to one unique Repair controller handler.
- Every successful response uses the stable `{ success: true, data }` envelope; mutation responses also include an operation message.
- Read endpoints return HTTP `200` and all Repair `GET` routes receive `Cache-Control: no-store` at the router boundary.
- Creation endpoints return HTTP `201`.
- Approved idempotent creation flows distinguish initial creation (`201`) from replay (`200`) and provide replay-aware messages.
- State updates and reversals return HTTP `200`.
- Errors are delegated through `next(error)` and remain typed through `RepairError`, `RepairFailureCode`, status, and optional details.

## Workflow integrity authority

The workflow integrity audit is registered as:

- `npm run verify:repair-workflow-integrity`

Its repository rules are:

- Repair and warranty-claim state changes must pass their explicit transition policies.
- `COMPLETED` and `CANCELLED` repair states remain terminal.
- Entering execution requires service-asset context and approved execution authorization.
- Part usage is blocked for terminal jobs and remains subject to execution authorization.
- Completion must pass transition validation, active-claim blocking, and the completion-readiness checklist.
- Customer handover requires a completed job, no active claim, a linked service asset, and full settlement whenever an approved estimate exists.
- Handover replay remains idempotent and must not duplicate handover history.
- Warranty claims begin in `DRAFT`, place the service asset in `IN_CLAIM`, follow claim transition policy, enforce resolution requirements, and return the asset to service only after a terminal claim state.
- Direct `RECEIVED` or `WAITING_PARTS` to `COMPLETED` remains allowed only because the dedicated completion service still enforces all completion guards; the generic status service cannot bypass that boundary.

## Verification authority

### Gate A — Repository Gate

Repository completion is represented by:

- `npm run verify:repair-contract-boundary-audit`
- `npm run verify:repair-module-isolation`
- `npm run verify:repair-api-contract-integrity`
- `npm run verify:repair-workflow-integrity`
- `npm run verify:repair-repository-gate`
- `npm run verify:repair-e2e-completion-audit`
- `npm run verify:repair-complete`

Gate A validates file ownership, route/controller/service exposure, layer direction, mutation authority, module isolation, direct Prisma ownership, response envelopes, HTTP status policy, query cache policy, idempotent response behavior, workflow transitions, completion guards, claim blocking, settlement and handover guards, typed failure contracts, server mounting, actor authorization wiring, milestone verifier registration, and final E2E command composition.

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
- Contract and boundary audit wiring: complete
- Module isolation audit wiring: complete
- API response integrity audit wiring: complete
- Workflow integrity audit wiring: complete
- Runtime verification: deferred
- Operational verification: deferred

This manifest records scope and delivery intent. Runtime and operational certification remain evidence-dependent.
