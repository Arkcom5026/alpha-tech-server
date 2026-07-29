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

## Existing Runtime Surface

```text
POST /api/sales/storefronts/:slug/identity/request
POST /api/sales/storefronts/:slug/identity/verify
```

## Repository Findings

The existing vertical slice already established storefront/session binding, durable challenge state, attempt locking, transaction-scoped verification, and proof-token hashing.

The authority review found two material gaps:

1. `commerceIdentityService` called OTP provider functions using incompatible signatures and referenced a nonexistent `deliverOtp` export. OTP request and verification could not execute correctly at runtime.
2. The durable migration had no Prisma multi-file projection and the existing contract did not lock service/provider API compatibility.

## Implemented Corrections

### OTP provider alignment

The service now uses the provider contract exactly:

```text
generateOtp()
hashOtp({ challengeSecret, otp })
verifyOtp({ challengeSecret, otp, expectedHash })
sendOtp({ phoneNormalized, otp, purpose })
```

OTP verifier hashes use HMAC SHA-256 with:

```text
COMMERCE_OTP_VERIFIER_SECRET
```

Production fails closed with `COMMERCE_OTP_VERIFIER_NOT_CONFIGURED` when this secret is missing. Development retains an explicit non-production fallback only.

### Identity authority

```text
Published storefront slug
→ active anonymous session token hash
→ branch/session context
→ pending OTP challenge
→ bounded attempts and expiry
→ verified short-lived proof token
```

- OTP lifetime: 5 minutes
- maximum failed attempts: 5
- proof lifetime: 10 minutes
- challenge row is locked during verification
- proof tokens are random 32-byte values and only SHA-256 hashes are persisted
- proof remains bound to one anonymous session
- identity verification alone does not reserve stock or create ProductReservation

### Prisma projection

Added:

```text
prisma/commerce-identity.prisma
```

Projection covers challenge/proof models, lifecycle enums, relations, uniqueness, and lookup indexes aligned with the existing migration.

### Focused contract

```text
npm run test:identity-at-commitment
```

Runs the existing foundation contract plus the new authority-review contract. The review contract locks provider signatures, environment-secret fail-closed policy, migration/projection alignment, session binding, expiry/locking behavior, public route ownership, and non-reservation separation.

## Changed Files

```text
docs/increments/identity-at-commitment-authority-review.md
package.json
prisma/commerce-identity.prisma
src/modules/sales/storefront/identity/commerceIdentityService.js
tests/identity-at-commitment-authority-review.contract.test.js
```

## Repository Evidence

```text
Base main SHA: 2abc02a5edecdb02a02969c616bc7a348fe02493
Repository implementation SHA: PENDING FINAL UPDATE
Ahead of main: 7 commits after this record update
Behind main: 0 commits
Changed files: 5
Unrelated files: NONE
```

## Gate State

### Repository Gate

```text
Current-main authority review: COMPLETE
Targeted changed-file scope: PASS
OTP service/provider API alignment: FIXED
Storefront/session binding: PASS BY CODE REVIEW
Attempt/expiry/replay boundary: PASS BY CODE REVIEW
Proof-token hashing and short-lived scope: PASS BY CODE REVIEW
Prisma projection: IMPLEMENTED
Focused repository contracts: COMPLETE
Repository Implementation: COMPLETE
```

### Runtime / Operational Gates — Deferred Owner Authority

```text
COMMERCE_OTP_VERIFIER_SECRET configuration: DEFERRED
OTP delivery provider configuration: DEFERRED
Prisma validate/generate: DEFERRED
Focused contract execution: DEFERRED
Representative request/verify lifecycle: DEFERRED
Replay/expiry/locking behavior: DEFERRED
Exact tested SHA: PENDING
Operational browser verification: DEFERRED
```

No Runtime PASS, Operational PASS, Production readiness, migration application, or deployment is claimed.
