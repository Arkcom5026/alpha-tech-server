# Server Revalidation & ProductReservation Commitment — Current-main Authority Review

## Mission

Review and complete the existing ProductReservation commitment authority on current `main` after Identity at Commitment was merged.

## Authority Chain

- Issue #71 — Commerce Platform Foundation
- PR #79 — Partner Store Capability Foundation (merged)
- PR #91 — Public Storefront Reconstruction (merged)
- PR #94 — Anonymous Shopping Session Authority Review (merged)
- PR #96 — Identity at Commitment Authority Review (merged)
- Issue #97 — current agenda
- PR #48 — historical product-decision evidence only

## Product Direction

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

This increment owns **Server Revalidation and ProductReservation Commitment** only.

## Review Scope

- storefront, branch, session, and identity-proof binding
- proof expiry, replay, one-time use, and atomic consumption
- current product publication, online-price, and stock revalidation
- transaction and locking boundary
- ProductReservation creation and lifecycle
- price snapshot and reservation expiry
- anonymous-session COMMITTED transition
- idempotency and duplicate commitment behavior
- separation from payment, Sale, fulfillment, Cart, and OrderOnline
- migration, Prisma, and contract alignment

## Architecture Constraints

1. Client-supplied branch, price, stock, customer, or authority values are not trusted.
2. ProductReservation is created only after server-side revalidation.
3. Identity proof must be active, unexpired, session-bound, and consumed atomically.
4. Anonymous shopping intent does not reserve stock before commitment.
5. Commitment does not create payment, Sale, delivery, or fulfillment authority.
6. Legacy Cart and OrderOnline remain unchanged.

## Verification Policy

Runtime and Operational verification are deferred under owner authority until the owner can test.

Deferred verification must remain explicit and must not be represented as PASS.

## Bootstrap State

```text
Base main SHA: bab3c7860fbd181237d23a368fef932085ed21ad
Repository working area: CREATED
Existing commitment implementation: PRESENT — UNVERIFIED
Repository review: NOT STARTED
Runtime verification: DEFERRED — OWNER AUTHORITY
Operational verification: DEFERRED — OWNER AUTHORITY
Production impact: NONE
```
