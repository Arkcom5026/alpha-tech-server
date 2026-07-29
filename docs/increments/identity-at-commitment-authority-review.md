# Identity at Commitment — Current-main Authority Review

## Mission

Review and complete the existing commerce identity authority on current `main` after Public Storefront and Anonymous Shopping Session foundations were merged.

## Authority Chain

- Issue #71 — Commerce Platform Foundation
- PR #79 — Partner Store Capability Foundation (merged)
- PR #91 — Public Storefront Reconstruction (merged)
- PR #94 — Anonymous Shopping Session Authority Review (merged)
- Issue #95 — current agenda
- PR #48 — historical product-decision evidence only

## Product Direction

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

This increment owns only **Identity at Commitment**.

## Review Scope

- identity proof/token model
- storefront, branch, and session binding
- OTP or equivalent verification lifecycle where implemented
- expiry, replay, and one-time-use behavior
- customer identity creation/linking boundaries
- separation from browsing and anonymous shopping intent
- separation from ProductReservation and commitment execution
- customer-safe response and error contracts
- persistence/schema alignment
- legacy customer/account compatibility

## Architecture Constraints

1. Browsing and anonymous session mutation remain unauthenticated.
2. Identity is required only at commitment-sensitive boundaries.
3. Client-supplied customer, branch, price, or authority values are not trusted.
4. Identity proof must remain scoped to the relevant storefront/session context.
5. Identity proof alone must not reserve inventory or create ProductReservation.
6. Legacy customer/account behavior remains unchanged.
7. Payment, fulfillment, and Sale conversion are non-goals.

## Verification Policy

Runtime and Operational verification are deferred under owner authority until the owner can test.

Deferred verification must remain explicit and must not be represented as PASS.

## Bootstrap State

```text
Base main SHA: 2abc02a5edecdb02a02969c616bc7a348fe02493
Repository working area: CREATED
Existing identity implementation: PRESENT — UNVERIFIED
Repository review: NOT STARTED
Runtime verification: DEFERRED — OWNER AUTHORITY
Operational verification: DEFERRED — OWNER AUTHORITY
Production impact: NONE
```
