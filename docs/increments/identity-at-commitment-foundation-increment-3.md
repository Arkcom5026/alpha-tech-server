# Identity at Commitment Foundation — Increment 3

## Mission

Create the customer identity boundary that activates only when an anonymous shopper enters a commitment action.

Canonical commerce flow:

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

This increment owns only **Identity at Commitment**.

## Product Goal

Allow customers to browse and maintain anonymous shopping intent without login, then request and verify identity only when they initiate a commitment action such as reservation or purchase.

## Planning and Working Authorities

- Issue #69 — Commerce Product Blueprint planning authority
- PR #72 — Public Discovery working area
- PR #74 — Partner Store Capability working area
- PR #76 — Anonymous Shopping Session working area
- PR #48 — accepted ProductReservation and commerce evidence

No Working Area PR is authorized to merge independently. Integration occurs only when the entire assigned Commerce Phase 1 agenda is complete.

## Authority Boundary

Identity at Commitment owns:

- a short-lived commitment identity challenge
- customer-supplied phone number normalization
- OTP challenge lifecycle
- proof that one commitment attempt passed identity verification
- linkage to an Anonymous Shopping Session only after successful verification

It does not own:

- public browsing
- Anonymous Shopping Session item authority
- product price
- stock availability
- ProductReservation
- Sale
- Payment
- Delivery
- permanent customer-account policy

## Security Direction

- OTP values are never stored in raw form
- only a cryptographic verifier/hash is persisted
- challenge expiry is short-lived
- verification attempts are bounded
- resend is rate-limited
- successful verification is single-purpose and short-lived
- no ProductReservation is created by OTP verification alone
- server revalidation remains mandatory after identity verification

## Initial Durable Contract

```text
CommerceIdentityChallenge
- id
- anonymousSessionId
- phoneNormalized
- purpose: RESERVATION_COMMITMENT
- status: PENDING | VERIFIED | EXPIRED | LOCKED | CANCELLED | CONSUMED
- otpHash
- expiresAt
- verifiedAt
- consumedAt
- attemptCount
- resendCount
- lastSentAt
- createdAt
- updatedAt

CommerceCommitmentIdentity
- id
- anonymousSessionId
- challengeId
- phoneNormalized
- verifiedAt
- expiresAt
- consumedAt
- createdAt
```

## Lifecycle Rules

1. Identity challenge may be requested only for an ACTIVE, unexpired Anonymous Shopping Session.
2. One active challenge per session and purpose is allowed.
3. OTP expiry is independent from Anonymous Shopping Session expiry.
4. Invalid verification increments the attempt counter.
5. Reaching the maximum attempt count locks the challenge.
6. Successful verification creates a short-lived commitment identity proof.
7. A commitment identity proof is not a Customer account and does not authenticate browsing.
8. The proof is consumed only by the later commitment/revalidation boundary.
9. A consumed proof cannot be reused.
10. ProductReservation creation is explicitly outside this increment.

## HTTP Direction

```text
POST /api/sales/storefronts/:slug/session/identity/challenge
POST /api/sales/storefronts/:slug/session/identity/verify
GET  /api/sales/storefronts/:slug/session/identity
DELETE /api/sales/storefronts/:slug/session/identity
```

Transport requires the existing anonymous session token and returns only customer-safe challenge/proof projections.

## Privacy Boundary

Public responses must not expose:

- internal challenge ID
- internal session ID
- branch ID
- OTP hash
- attempt internals beyond customer-safe remaining-attempt information
- Customer or Employee records

## Explicit Non-goals

- customer registration
- customer login
- permanent password or account creation
- social login
- employee authentication
- ProductReservation creation
- stock reservation
- payment
- checkout completion
- merge to `main`
- production deployment

## Working Area Policy

- no independent merge to `main`
- no CI requirement
- no Test/Build requirement before final agenda integration
- owner-led Production validation occurs only after the full assigned agenda is complete
- no deployment or production impact is authorized

## Initial Gate State

- Product contract: CREATED
- Durable model: PENDING
- OTP provider boundary: PENDING
- HTTP vertical slice: PENDING
- Repository contract: PENDING
- Repository review: PENDING
- Commerce Phase 1 integration: PENDING
- Merge / Deploy / Production impact: NONE
