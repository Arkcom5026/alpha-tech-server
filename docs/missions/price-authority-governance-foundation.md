# Price Authority & Governance Foundation

## Mission

Establish strict, branch-scoped governance over every existing price field and runtime mutation path before adding new schema or UI.

## Current Prisma Authority

`BranchPrice` currently stores:

- `costPrice`
- `priceRetail`
- `priceWholesale`
- `priceTechnician`
- `priceOnline`
- `effectiveDate`
- `expiredDate`
- `isActive`
- `note`
- `updatedBy`

The current model is one row per `(productId, branchId)`.

## Current Runtime Observation

`src/modules/product/pricing/runtime/branchPriceRuntimeService.js` currently:

- accepts direct single and bulk upserts,
- maps legacy aliases,
- validates only that expiry does not precede effective date,
- does not yet enforce explicit source, reason, lifecycle, approval, minimum-margin, or immutable history authority.

## Phase 1 — Current-State Audit

Inventory and classify every price:

1. Prisma field and storage owner.
2. Read paths and fallback rules.
3. Mutation entry points.
4. Actor and branch authority.
5. Calculation or derivation rules.
6. Effective-period behavior.
7. Audit and rollback evidence.
8. Downstream dependencies in purchase, stock, sales, repair, service, online, promotion, tax, and reporting.

## Required Price Meanings

The audit must define canonical semantics for:

- inventory cost authority,
- purchase price authority,
- retail price authority,
- wholesale price authority,
- technician price authority,
- online price authority,
- service and repair charge authority,
- promotion or discount authority.

No field may be treated as interchangeable merely because it contains a monetary value.

## Governance Invariants

- Branch is an independent store/tenant.
- Authenticated `branchId` is the only normal store-level authority.
- Client-supplied branch, role, employee, or approval authority is never trusted.
- No silent zero-price fallback.
- No silent substitution between cost, purchase, retail, wholesale, technician, online, service, or promotion prices.
- Effective and expiry windows must be deterministic.
- Direct and bulk mutations must share the same validation policy.
- Material price changes must retain actor, reason, previous state, resulting state, and time.
- Historical transaction prices remain immutable snapshots and are not rewritten when current prices change.
- Missing Cost Resolution remains the certified recovery authority for missing inventory cost until explicitly integrated into the wider price platform.

## Delivery Plan

### Increment 1 — Price Surface Audit

Produce the authoritative matrix of fields, endpoints, services, fallbacks, and consumers.

### Increment 2 — Price Contracts and Validation Policy

Define canonical DTOs and reusable validation for value, dates, branch ownership, and cross-price relationships.

### Increment 3 — Mutation Authority

Route single and bulk updates through one controlled command boundary with actor and reason authority.

### Increment 4 — Timeline and Audit

Introduce append-only change evidence without rewriting historical transaction snapshots.

### Increment 5 — Lifecycle and Approval

Add draft, review, approval, scheduling, effective, expiry, and archive rules only where business risk requires them.

### Increment 6 — Price Integrity

Detect missing, stale, conflicting, below-cost, expired, and unauthorized prices.

### Increment 7 — FE E2E and Certification

Deliver branch-scoped UI, permission-aware actions, CI, targeted tests, exact-SHA ALDE certification, publication, and runtime evidence.

## Safety

- No Production data mutation during design and certification.
- No Prisma rewrite before the current-state audit proves a necessary gap.
- Existing reads remain backward compatible during incremental adoption.
- One increment must be independently testable and reversible.
