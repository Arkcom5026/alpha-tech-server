# Anonymous Shopping Session — Current-main Authority Review

## Mission

Review and complete the existing anonymous shopping-session authority on current `main` after Partner Store Capability and Public Storefront foundations were merged.

## Authority Chain

- Issue #71 — Commerce Platform Foundation
- PR #79 — Partner Store Capability Foundation (merged)
- PR #91 — Public Storefront Current-main Reconstruction (merged)
- Issue #93 — current agenda
- PR #94 — current Working Area
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

## Authority Review Findings

The existing Route → Controller → Service → Repository flow was present on current `main`, but three repository-scoped gaps were found:

1. Product publication revalidation used stale `BranchPrice` column names: `active`, `effectiveAt`, and `expiresAt`.
2. The migration existed without a Prisma multi-file projection for `AnonymousShoppingSession` and `AnonymousShoppingSessionItem`.
3. No focused repository contract or package-script wiring protected token, branch, lifecycle, and non-reservation semantics.

## Implemented Corrections

### Publication authority alignment

The repository now uses the same current authority as Public Storefront:

```text
BranchPrice.isActive
BranchPrice.priceOnline
BranchPrice.effectiveDate
BranchPrice.expiredDate
```

Anonymous item mutation accepts a product only when the product is active and the branch-owned online price is active, positive, and inside its publication window.

### Token and branch authority

- Public tokens are generated with 32 random bytes.
- Only SHA-256 token hashes are persisted and queried.
- Every session lookup and mutation is bound to the branch resolved from an enabled storefront slug.
- Active and unexpired session state is required.
- Client-supplied branch and price values are not accepted.

### Session lifecycle

- Session TTL: 72 hours.
- Maximum item quantity: 99.
- Item set uses upsert semantics for one product per session.
- Remove is repeat-safe and returns the current session state.
- Abandon transitions only an active matching session to `ABANDONED`.
- Session records pre-commit shopping intent only.

### Prisma projection

```text
prisma/anonymous-shopping-session.prisma
```

Defines:

- `AnonymousShoppingSession`
- `AnonymousShoppingSessionItem`
- `AnonymousShoppingSessionStatus`
- item uniqueness and session/expiry lookup indexes aligned with the migration

### Focused repository contract

```text
npm run test:anonymous-shopping-session
```

The contract verifies:

- migration and Prisma projection alignment
- public unauthenticated route surface
- token header contract and SHA-256 persistence
- storefront/branch binding
- active/unexpired lifecycle checks
- current BranchPrice publication field names
- quantity and TTL policy
- no StockBalance mutation, inventory reservation, ProductReservation, Cart, or OrderOnline coupling

## Changed Files

```text
docs/increments/anonymous-shopping-session-authority-review.md
package.json
prisma/anonymous-shopping-session.prisma
src/modules/sales/storefront/session/anonymousShoppingSessionRepository.js
tests/anonymous-shopping-session-authority.contract.test.js
```

## Gate State

### Repository Gate

```text
Current-main authority review: COMPLETE
Targeted changed-file scope: PASS
Existing Route → Controller → Service → Repository ownership: REVIEWED
BranchPrice publication alignment: FIXED
Token hashing and branch binding: PASS BY CODE REVIEW
Persistence migration: PRESENT
Prisma projection: IMPLEMENTED
Non-reservation separation: PASS BY CODE REVIEW
Focused repository contract: COMPLETE
Repository Implementation: COMPLETE
```

### Runtime / Operational Gates — Deferred Owner Authority

```text
Prisma validate/generate: DEFERRED
Focused contract execution: DEFERRED
Representative session lifecycle verification: DEFERRED
Published/unpublished product behavior: DEFERRED
Expiry and abandonment behavior: DEFERRED
Exact tested SHA: PENDING
Operational browser verification: DEFERRED
```

No Runtime PASS, Operational PASS, Production readiness, migration application, or deployment is claimed.

## Current State

```text
Base main SHA: 991c7ae386f69cc6d8b36358a6dc4ad274485ef8
Repository implementation SHA: fe739c78b28720824ae4fbdd15f47963acc1eff7
Ahead of main: 5 commits
Behind main: 0 commits
Changed files: 5
Repository Implementation: COMPLETE
Runtime verification: DEFERRED — OWNER AUTHORITY
Operational verification: DEFERRED — OWNER AUTHORITY
Production impact: NONE
```

## Remaining Before Merge

1. Preserve deferred verification debt explicitly.
2. Recheck mergeability and current-main alignment.
3. Merge only under explicit owner authorization.
4. Continue the roadmap with Identity at Commitment after merge.
