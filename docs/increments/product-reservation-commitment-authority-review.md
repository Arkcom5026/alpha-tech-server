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

## Repository Review Findings

The existing commitment implementation already provided:

- public commitment route with session, identity proof, and idempotency headers
- storefront/branch resolution from published capability
- transaction-scoped replay lookup
- row locks for session, proof, items, and price authority
- current stock availability check and durable reserved allocation
- ProductReservation and item snapshot creation
- stock reservation movement
- atomic proof/challenge/session lifecycle transitions
- 30-minute reservation expiry
- separation from payment, Sale, fulfillment, Cart, and OrderOnline

One material runtime defect and one contract defect were found:

1. Product publication revalidation used stale `BranchPrice.active`, `effectiveAt`, and `expiresAt` columns.
2. The foundation contract asserted those stale names, so it protected the defect instead of detecting it.

## Implemented Corrections

Commitment publication revalidation now uses current authority fields:

```text
Product.active
BranchPrice.isActive
BranchPrice.priceOnline > 0
BranchPrice.effectiveDate
BranchPrice.expiredDate
```

Focused contracts now verify:

- stale BranchPrice fields are absent
- replay remains bound to original session/proof hashes
- proof, challenge, and anonymous session transitions are atomic
- stock allocation and reservation movement are durable
- money aggregation uses integer cents and two-decimal durable writes
- payment, Sale, fulfillment, and legacy commerce authorities remain untouched

## Focused Verification Command

```text
npm run test:product-reservation-commitment
```

This command runs:

```text
tests/product-reservation-commitment-foundation.contract.test.js
tests/product-reservation-commitment-authority-review.contract.test.js
```

## Changed Files

```text
docs/increments/product-reservation-commitment-authority-review.md
package.json
src/modules/sales/storefront/commitment/productReservationCommitmentRepository.js
tests/product-reservation-commitment-foundation.contract.test.js
tests/product-reservation-commitment-authority-review.contract.test.js
```

## Repository Evidence

```text
Base main SHA: bab3c7860fbd181237d23a368fef932085ed21ad
Repository implementation SHA: pending final evidence update
Ahead of main: 6 commits after this documentation update
Behind main: 0 commits
Changed files: 5
Unrelated files: NONE
```

## Gate State

### Repository Gate

```text
Current-main authority review: COMPLETE
Targeted changed-file scope: PASS
BranchPrice publication alignment: FIXED
Storefront/session/proof binding: PASS BY CODE REVIEW
Idempotency replay boundary: PASS BY CODE REVIEW
Stock revalidation/allocation: PASS BY CODE REVIEW
Atomic proof/challenge/session consumption: PASS BY CODE REVIEW
Focused repository contracts: COMPLETE
Repository Implementation: COMPLETE
```

### Runtime / Operational Gates — Deferred Owner Authority

```text
Focused contract execution: DEFERRED
Representative commitment lifecycle: DEFERRED
Concurrent replay/locking behavior: DEFERRED
Stock allocation rollback behavior: DEFERRED
Reservation expiry/release behavior: DEFERRED
Exact tested SHA: PENDING
Operational browser verification: DEFERRED
```

No Runtime PASS, Operational PASS, Production readiness, migration application, or deployment is claimed.
