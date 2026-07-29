# Partner Store Capability Foundation — Current-main Reconstruction

## Mission

Reconstruct the minimum Partner Store Capability foundation on top of current `main` so Public Storefront PR #72 can become eligible for Repository, Runtime, and Operational certification without importing materially diverged history from Draft PR #48.

## Parent Authority

- Issue #71 — Commerce Platform Foundation
- Issue #78 — Partner Store Capability Foundation — Current-main Reconstruction
- PR #72 — dependent Public Storefront working area
- PR #48 — historical contract and migration evidence only

## Increment Policy

```text
One increment = one branch = one Draft PR
```

Branch:

```text
feature/partner-store-capability-foundation
```

Base SHA at bootstrap:

```text
c38aef64e208fa9e627649ab084c3e348762465a
```

## Approved Scope

- Reconstruct only the minimum Partner Store Capability persistence/runtime authority required by PR #72.
- Preserve evidence-supported semantics from PR #48 without merging, rebasing, or wholesale cherry-picking its history.
- Use additive and non-destructive Prisma migration semantics.
- Establish branch/store publication, pickup, delivery-fee, and service-area policy authority.
- Add focused migration and contract verification.
- Record exact source, base, implementation, and tested SHA evidence.

## Required Capability

- Stable storefront slug
- Customer-safe display name and contact details
- Enabled/published state
- Pickup enabled state
- Delivery enabled state
- Delivery fee mode and fixed fee where applicable
- Service-area mode
- Explicit service-area rows where applicable
- Branch ownership and isolation

## Explicit Non-goals

- Public storefront query implementation
- ProductReservation lifecycle redesign
- Anonymous Shopping Session
- Anonymous Cart
- OTP or Customer Identity
- Checkout or payment
- Marketplace
- Merchant fulfillment UI
- Sale conversion
- Legacy OrderOnline replacement

## Safety Constraints

1. Start from current `main`.
2. Do not merge, rebase, or import the diverged PR #48 branch wholesale.
3. Apply targeted reconstruction only.
4. Migration must be additive and non-destructive.
5. Existing runtime and business behavior must remain unchanged.
6. Do not introduce a competing Storefront or commerce transaction aggregate.
7. Branch scope must be enforceable and testable.
8. Public data exposure remains owned by PR #72.

## Required Gates

### Repository Gate

- Targeted file scope
- Accepted authority semantics documented
- No unrelated PR #48 history imported
- Prisma schema and migration aligned
- Additive/non-destructive migration review
- Contract and migration tests wired
- `git diff --check`

### Runtime Gate

- Dependency install succeeds in the local authority environment
- Prisma validate and generate pass
- Migration applies against a representative database
- Focused foundation tests pass
- Create/read/update policy behavior works
- Branch isolation works
- Enum and service-area behavior work
- Exact tested SHA recorded

### Operational Enablement

This foundation has no independent customer UI gate. Its operational value is certified by enabling PR #72:

```text
GET /api/sales/storefronts/:slug
→ Partner Store Capability
→ Product / Price / Inventory projection
→ customer-safe public response
```

## Bootstrap State

```text
Repository working area: OPEN
Implementation: NOT STARTED
Repository Gate: PENDING
Runtime Gate: PENDING
Operational impact: NONE
Production impact: NONE
```
