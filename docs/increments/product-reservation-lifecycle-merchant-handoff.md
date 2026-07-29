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

## Authority Review Result

Current-main review is complete.

### Present Authority

- public ProductReservation commitment runtime
- transaction-scoped creation
- branch-scoped price and stock checks
- `StockBalance.reserved` increment
- `StockMovement` with `RESERVE`
- commitment idempotency
- separation from Sale, Payment, Delivery, PosHeldCart, and OrderOnline

### Proven Gaps

- `ProductReservation` and `ProductReservationItem` are not represented in the current Prisma schema
- ProductReservation status and transition policy are not represented in Prisma authority
- expiry and cancellation runtime are not present
- exact-once release of `StockBalance.reserved` is not present
- `RELEASE` stock movement authority is not present
- replay-safe terminal transition command authority is not present
- merchant branch-scoped queue and action surface are not present
- merchant acceptance/rejection and fulfillment handoff state are not present
- scheduled/manual expiry execution surface is not present

## Targeted Implementation Plan

### Slice 1 — Prisma Reconciliation and Lifecycle Contract

- restore existing ProductReservation aggregate and item definitions into Prisma authority without recreating existing tables
- preserve all existing database column and relation names
- add only lifecycle fields and constraints required by this increment
- define explicit lifecycle states and transition policy
- define replay-safe command ownership for terminal transitions
- preserve existing public commitment and legacy runtime compatibility

### Slice 2 — Lifecycle and Exact-once Release

- branch-safe expire and cancel commands
- transaction-scoped terminal transition
- exact-once decrement of `StockBalance.reserved`
- append `RELEASE` stock movements
- reject underflow and duplicate release
- support manual expiry execution and a scheduler-safe batch surface

### Slice 3 — Merchant Fulfillment Handoff

- branch-scoped reservation queue
- merchant acknowledgment and acceptance/rejection boundary
- fulfillment-ready handoff state
- no implicit Sale, Payment, or Delivery creation

### Slice 4 — Review and Verification

- focused contract tests
- repository ownership and boundary review
- Runtime Gate
- Operational Gate
- merge readiness

## Architecture Constraints

1. Every transition is branch-safe and transaction-scoped.
2. Stock release occurs exactly once.
3. Expiry and cancellation are replay-safe.
4. Merchant access is limited to assigned store/branch authority.
5. Handoff does not silently create Payment, Sale, or Delivery authority.
6. Legacy internal flows remain compatible.
7. Existing migrations are immutable; new alignment is additive.
8. Existing ProductReservation tables must not be recreated or renamed.

## Verification Policy

Runtime and Operational verification remain deferred under owner authority until implementation is complete.

Deferred verification must remain explicit and must not be represented as PASS.

## Current State

```text
Base main SHA: 8ad9652a8e6c6cccea662c3734abec9a8b80511d
Authority Review: COMPLETE
Gap Analysis: COMPLETE
Targeted Implementation Plan: RECORDED
Prisma reconciliation: NEXT
Lifecycle implementation: PENDING
Merchant handoff implementation: PENDING
Runtime verification: DEFERRED — NOT PASS
Operational verification: DEFERRED — NOT PASS
Production impact: NONE
```
