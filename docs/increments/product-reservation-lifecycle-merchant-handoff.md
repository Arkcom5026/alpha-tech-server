# ProductReservation Lifecycle & Merchant Fulfillment Handoff — Current-main Authority Review

## Mission

Review and complete ProductReservation lifecycle, expiry/release, and merchant fulfillment handoff authorities on current `main` after public ProductReservation commitment was merged.

## Authority Chain

- Issue #71 — Commerce Platform Foundation
- PR #79 — Partner Store Capability Foundation (merged)
- PR #91 — Public Storefront Reconstruction (merged)
- PR #94 — Anonymous Shopping Session Authority Review (merged)
- PR #96 — Identity at Commitment Authority Review (merged)
- PR #98 — ProductReservation Commitment Authority Review (merged)
- Issue #100 — current agenda

## Product Continuation

```text
ProductReservation ACTIVE
→ Merchant Review / Acceptance Boundary
→ Expiry or Cancellation
→ Stock Release
→ Fulfillment Handoff
```

This increment owns only reservation lifecycle, release, and merchant handoff boundaries.

## Review Scope

- status model and transition policy
- expiry detection and durable transition
- cancellation authority
- exact-once stock release
- RELEASE stock movements
- replay/idempotency of terminal transitions
- store/branch isolation for merchant access
- merchant acknowledgment/acceptance boundary
- separation from Payment, Sale, Delivery, and customer-account authority
- scheduled/manual expiry execution surface
- migration, Prisma, and focused contracts

## Architecture Constraints

1. Every transition is branch-safe and transaction-scoped.
2. Stock release occurs exactly once.
3. Expiry and cancellation are replay-safe.
4. Merchant access is limited to assigned store/branch authority.
5. Handoff does not silently create Payment, Sale, or Delivery authority.
6. Legacy internal reservation flows remain compatible.

## Verification Policy

Runtime and Operational verification remain deferred under owner authority.

Deferred verification must remain explicit and must not be represented as PASS.

## Bootstrap State

```text
Base main SHA: f8d7fd3062e9e1e5fc20155ab6c5c2d0381c83a8
Repository working area: CREATED
Existing lifecycle implementation: UNVERIFIED
Merchant handoff implementation: UNVERIFIED
Runtime verification: DEFERRED — OWNER AUTHORITY
Operational verification: DEFERRED — OWNER AUTHORITY
Production impact: NONE
```
