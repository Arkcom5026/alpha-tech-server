# Tax Increment A — STEP 001–004 Contract

## Authority

- Step Package: Alpha-Tech Step Package v0.1
- Increment: Tax Intake Foundation
- Branch: `feature/tax-intake-foundation`
- Repositories: `alpha-tech-server`, `alpha-tech-client`

## Mission

Deliver one continuous business flow covering:

1. STEP 001 — Tax Module Foundation
2. STEP 002 — Tax Document Management
3. STEP 003 — Tax Document Lifecycle
4. STEP 004 — Business Document Candidate

## Required end-to-end flow

```text
Business document reference
  -> candidate registration
  -> candidate mapping
  -> tax document identity
  -> tax document lifecycle
  -> queryable API result
  -> frontend intake/review surface
```

## Domain ownership

- `src/modules/tax/` owns tax capabilities.
- Other modules publish immutable business-document references; they do not write Tax storage directly.
- Tax Document is the central tax-domain entity.
- Candidate is the intake boundary and must preserve source identity.
- Lifecycle transitions are enforced inside Tax application services.

## STEP acceptance

### STEP 001

- Tax module public entry exists.
- Internal boundaries are explicit.
- Existing Tax Period capability is exported without changing behavior.

### STEP 002

- Durable Tax Document identity and status exist.
- Repository, service, controller, routes, and query contract exist.

### STEP 003

- Allowed transitions are explicit and tested.
- Invalid transitions fail deterministically.
- Transition history is append-oriented.

### STEP 004

- Candidate registration is idempotent by branch + source type + source identity.
- Candidate mapping creates or links exactly one Tax Document.
- Source modules remain decoupled from Tax persistence.

## Delivery gates

- Repository Gate: structure, contracts, migration, API wiring, tests, diff review.
- Runtime Gate: Prisma validate/generate, migration, backend tests, frontend lint/build.
- Operational Gate: FE -> API -> Tax service -> Prisma -> DB -> FE.

No STEP is COMPLETE without evidence against its own acceptance criteria.
