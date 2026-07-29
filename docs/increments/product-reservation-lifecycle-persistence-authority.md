# ProductReservation Lifecycle Persistence Authority — Slice 2

## Mission

Extend the canonical ProductReservation foundation with additive lifecycle persistence authority required for replay-safe transitions and exact-once stock release.

## Repository Finding

The canonical ProductReservation foundation now establishes the aggregate, items, commitment vocabulary, branch ownership, and lifecycle status vocabulary.

However, the current canonical model does not yet persist:

- lifecycle command replay identity
- transition history
- stock release completion authority
- actor and reason audit
- optimistic transition version

Without those fields or equivalent durable records, a repository adapter cannot prove exact-once stock release after retries, process restarts, or concurrent commands.

## Required Additive Authority

### ProductReservation

- `stockReleasedAt DateTime?`
- `version Int @default(1)`
- lifecycle command relation
- lifecycle event relation

### ProductReservationLifecycleCommand

Durable idempotency record scoped to reservation and command key.

Required fields:

- reservationId
- branchId
- commandKey
- commandType
- fromStatus
- toStatus
- stockReleased
- actorId
- reason
- occurredAt
- createdAt

Required invariant:

- unique `(reservationId, commandKey)`

### ProductReservationLifecycleEvent

Immutable transition audit record.

Required fields:

- reservationId
- branchId
- commandId
- fromStatus
- toStatus
- actorId
- reason
- occurredAt
- createdAt

## Transaction Contract

One lifecycle transaction must perform the following atomically:

1. lock reservation under `reservationId + branchId`
2. resolve command replay
3. validate transition against current status
4. for CANCEL or EXPIRE, release each active reservation line exactly once
5. decrement `StockBalance.reserved` with underflow protection
6. append `StockMovement(RELEASE)` per product line
7. set `stockReleasedAt`
8. update reservation status and increment version
9. insert lifecycle command authority
10. insert lifecycle event

## Exact-once Rule

`stockReleasedAt` and the unique lifecycle command record are complementary safeguards:

- command uniqueness prevents the same command key from executing twice
- `stockReleasedAt` prevents a different terminal command from releasing the same stock twice
- the transaction boundary ensures status, stock, movement, and replay evidence commit together

## Boundary

This slice does not create Sale, Payment, Delivery, or customer-account authority.

HTTP routes, scheduler execution, and merchant queue surfaces remain subsequent slices.

## Verification State

```text
Canonical ProductReservation foundation: PRESENT
Lifecycle application service: PRESENT
Lifecycle persistence authority: DESIGNED — IMPLEMENTATION NEXT
Runtime verification: NOT PASS
Operational verification: NOT PASS
Production impact: NONE
```
