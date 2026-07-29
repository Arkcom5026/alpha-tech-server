# Anonymous Shopping Session — Current-main Authority Review

## Mission

Review and complete the existing anonymous shopping-session authority on current `main` after Partner Store Capability and Public Storefront foundations were merged.

## Authority Chain

- Issue #71 — Commerce Platform Foundation
- PR #79 — Partner Store Capability Foundation (merged)
- PR #91 — Public Storefront Current-main Reconstruction (merged)
- Issue #93 — current agenda
- PR #48 — historical product-decision evidence only

## Product Direction

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

This increment owns only **Anonymous Shopping Session**.

## Existing Route Surface

```text
POST   /api/sales/storefronts/:slug/session
GET    /api/sales/storefronts/:slug/session
PUT    /api/sales/storefronts/:slug/session/items/:productId
DELETE /api/sales/storefronts/:slug/session/items/:productId
DELETE /api/sales/storefronts/:slug/session
```

## Review Scope

- session token and identity authority
- storefront/branch binding
- item quantity semantics
- product and publication validation
- price revalidation boundary
- expiry and abandonment lifecycle
- idempotency and replay behavior
- persistence/schema alignment
- customer-safe response
- separation from Cart, ProductReservation, commitment, payment, and inventory reservation

## Architecture Constraints

1. Anonymous session records shopping intent only.
2. It must not reserve or decrement inventory.
3. Server authorities own price, product eligibility, and storefront binding.
4. One session remains bound to one storefront/branch.
5. Legacy Cart and OrderOnline remain unchanged.
6. Identity, OTP, commitment, payment, and fulfillment are non-goals.

## Verification Policy

Runtime and Operational verification are deferred under owner authority until the owner can test.

Deferred verification must remain explicit and must not be represented as PASS.

## Bootstrap State

```text
Base main SHA: 991c7ae386f69cc6d8b36358a6dc4ad274485ef8
Repository working area: CREATED
Existing implementation: PRESENT — UNVERIFIED
Repository review: NOT STARTED
Runtime verification: DEFERRED — OWNER AUTHORITY
Operational verification: DEFERRED — OWNER AUTHORITY
Production impact: NONE
```
