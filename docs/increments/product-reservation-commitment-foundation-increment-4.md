# Product Reservation Commitment Foundation — Increment 4

## Mission

Create the server-authoritative commitment boundary that converts verified anonymous shopping intent into a durable ProductReservation only after complete revalidation.

Canonical commerce flow:

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

This increment owns only **Server Revalidation and ProductReservation Commitment**.

## Planning and Working Authorities

- Issue #69 — Commerce Product Blueprint planning authority
- PR #72 — Public Discovery working area
- PR #74 — Partner Store Capability working area
- PR #76 — Anonymous Shopping Session working area
- PR #80 — Identity at Commitment working area
- PR #48 — accepted ProductReservation and reservation-foundation evidence

No Working Area PR is authorized to merge independently. Integration occurs only after the entire assigned Commerce Phase 1 agenda is complete.

## Product Goal

Allow a customer who has a valid Anonymous Shopping Session and a verified short-lived identity proof to request a reservation commitment. The server must re-read and validate every authoritative source before creating any reservation.

## Authority Boundary

This increment owns:

- commitment command validation
- one-transaction server revalidation
- proof-token validation and single-use consumption
- anonymous-session lifecycle transition at commitment
- current online price projection into reservation lines
- current stock-availability revalidation
- ProductReservation creation
- ProductReservationItem creation
- idempotent commitment by explicit commitment key

It does not own:

- public browsing
- OTP delivery
- customer account creation
- Sale creation
- Payment
- Delivery fulfilment
- marketplace aggregation

## Commitment Preconditions

A commitment is eligible only when all conditions are true in the same database transaction:

1. Storefront is enabled and slug resolves to the expected Branch.
2. Anonymous Shopping Session exists, belongs to that Branch, is ACTIVE, and is unexpired.
3. Session contains at least one item.
4. Commitment Identity proof hash exists for the same session, is unconsumed, and is unexpired.
5. Every Product is active.
6. Every BranchPrice is active.
7. Every `priceOnline` exists and is greater than zero.
8. Every price publication window is currently effective.
9. Every requested quantity remains positive and within policy.
10. Current available stock can satisfy the commitment policy.
11. No other commitment has already consumed the same proof.
12. The idempotency key has not already produced a different command result.

## Revalidation Policy

Anonymous Session data is treated as intent only.

At commitment the server must not trust:

- client-supplied price
- client-supplied stock state
- previous browse response
- previous session display data
- identity proof without durable hash lookup

The server must re-read Product, BranchPrice, StockBalance, AnonymousShoppingSession, AnonymousShoppingSessionItem, CommerceCommitmentIdentity, and ProductReservation authorities.

## Reservation Direction

The commitment creates one durable ProductReservation for one Branch and one verified phone identity.

Initial line projection:

```text
ProductReservation
- branchId
- reservationNumber
- status
- customerPhone
- anonymousSessionId
- commitmentIdentityId
- idempotencyKey
- expiresAt
- createdAt
- updatedAt

ProductReservationItem
- reservationId
- productId
- quantity
- unitPrice
- lineTotal
- createdAt
- updatedAt
```

Price is captured only at commitment from current `BranchPrice.priceOnline`.

## Stock Policy

This increment must preserve the repository's accepted reservation authority from PR #48.

The final implementation must explicitly define whether ProductReservation:

- creates durable reserved quantity in StockBalance, or
- creates reservation allocation rows that are included in available-stock calculation.

It must not silently mutate on-hand stock and must not create Sale stock movement.

## Lifecycle Direction

Successful commitment must occur atomically:

1. Lock Anonymous Shopping Session.
2. Lock Commitment Identity proof.
3. Lock or otherwise serialize authoritative stock rows.
4. Revalidate storefront, session, proof, products, prices, publication windows, and stock.
5. Create ProductReservation and items.
6. Apply reservation allocation authority.
7. Consume Commitment Identity proof.
8. Mark Anonymous Shopping Session `COMMITTED`.
9. Return customer-safe reservation projection.

Any failure must roll back the complete transaction.

## HTTP Direction

```text
POST /api/sales/storefronts/:slug/reservations/commit
```

Required transport:

- `X-Anonymous-Session-Token`
- `X-Commerce-Identity-Proof`
- `X-Idempotency-Key`

The request body must not contain authoritative price, branch ID, stock quantity, or internal identity IDs.

## Customer-safe Response Direction

The public response may expose:

- reservation number
- status
- expiry
- masked phone
- product ID/name
- committed quantity
- committed unit price
- line total
- reservation total

The response must not expose:

- branch ID
- internal reservation ID
- internal session ID
- commitment identity ID
- proof hash
- cost price
- exact internal stock balance

## Failure Contract Direction

Expected failure categories include:

- storefront unavailable
- session missing, expired, abandoned, or already committed
- session empty
- identity proof missing, expired, consumed, or belongs to another session
- product unavailable
- online price unavailable or outside publication window
- insufficient stock
- idempotency conflict
- concurrent commitment conflict

Failures before durable success must leave proof and session unconsumed unless the failure itself represents an already-completed idempotent commitment.

## Explicit Non-goals

- customer registration
- customer login
- payment authorization
- Sale creation
- delivery scheduling
- reservation fulfilment
- reservation cancellation
- merge to `main`
- production deployment

## Working Area Policy

- no independent merge to `main`
- no CI requirement
- no Test/Build requirement before final agenda integration
- owner-led Production validation occurs after the complete assigned agenda is integrated
- no deployment or production impact is authorized

## Initial Gate State

- Product contract: CREATED
- Existing ProductReservation authority discovery: PENDING
- Durable alignment/reconstruction: PENDING
- Revalidation repository: PENDING
- Commitment service: PENDING
- HTTP boundary: PENDING
- Repository contract: PENDING
- Repository review: PENDING
- Commerce Phase 1 integration: PENDING
- Merge / Deploy / Production impact: NONE
