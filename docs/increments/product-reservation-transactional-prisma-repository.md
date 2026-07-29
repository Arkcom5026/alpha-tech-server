# ProductReservation Transactional Prisma Repository — Slice 3

## Mission

Implement the durable repository adapter behind the existing ProductReservation lifecycle application service, preserving branch isolation, optimistic concurrency, replay safety, and exact-once stock release.

## Authority Baseline

- PR #101 head before this increment: `9e9e5ac8b705fdd1307cabef23ed8ee11ef37fb3`
- Canonical ProductReservation and ProductReservationItem: present
- Lifecycle command and event persistence authority: present
- Lifecycle application service and repository port: present
- Existing commitment runtime reserves `StockBalance.reserved` and appends `StockMovement(RESERVE)` transactionally

## Required Repository Surface

Implement the existing port methods:

- `findCommandReplay({ reservationId, branchId, commandKey })`
- `findForLifecycleCommand({ reservationId, branchId })`
- `executeLifecycleTransition({ command, transition, current })`

## Transaction Contract

`executeLifecycleTransition` must run in one database transaction:

1. Lock the ProductReservation row by `id + branchId`.
2. Re-check command replay inside the transaction.
3. Re-check current status, version, and stockReleasedAt.
4. Reject optimistic version mismatch.
5. For release transitions, aggregate active ProductReservationItem quantities by product.
6. Decrement `StockBalance.reserved` using `reserved >= quantity` underflow guards and branch ownership.
7. Append one `StockMovement(RELEASE)` per aggregated product quantity using:
   - `refType = PRODUCT_RESERVATION`
   - `refId = reservationId`
   - actor employee when supplied
8. Update ProductReservation status, stockReleasedAt when applicable, and increment version.
9. Insert ProductReservationLifecycleCommand.
10. Insert ProductReservationLifecycleEvent linked to that command.
11. Return the updated reservation and stockReleased result.

All steps must commit or roll back together.

## Replay Rules

- Replay lookup is scoped by reservationId, branchId, and commandKey.
- Same key and same command type returns the recorded result.
- Same key with a different command type remains an application conflict.
- A concurrent unique-key race must resolve by loading the committed replay, not by repeating stock release.

## Exact-once Rules

- `stockReleasedAt` prevents a different terminal command from releasing stock again.
- unique `(reservationId, commandKey)` prevents duplicate execution of the same command.
- optimistic `version` prevents stale transition writes.
- guarded `StockBalance.reserved` decrement prevents underflow.
- command, event, status, version, stock release, and movements share one transaction.

## Error Contract

Repository errors should expose stable application-facing codes for:

- reservation missing in branch
- optimistic version conflict
- stock already released
- reserved stock underflow or missing StockBalance
- command replay race conflict that cannot be reconciled

Do not leak raw Prisma or PostgreSQL error text as the public error contract.

## Scope Boundary

This increment must not add:

- HTTP routes
- scheduler or expiry batch execution
- merchant queue queries
- Sale, Payment, Delivery, or Order creation
- schema or migration changes unless a proven implementation defect requires an additive correction

## Required Verification

Focused repository contract tests must prove at minimum:

- branch-scoped lookup
- replay result projection
- optimistic version guard
- CANCEL/EXPIRE release behavior
- ACCEPT and MARK_FULFILLMENT_READY do not release stock
- guarded reserved decrement
- RELEASE movement vocabulary and reservation reference
- command and event persistence
- one transaction boundary
- no Sale, Payment, or Delivery authority

Runtime/database verification remains separate and must not be claimed without execution evidence.

## Delivery Rules

- branch: `feature/product-reservation-lifecycle-merchant-handoff`
- fast-forward only
- no force push
- no main modification
- no merge or deployment
