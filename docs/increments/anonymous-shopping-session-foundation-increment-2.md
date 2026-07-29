# Anonymous Shopping Session Foundation — Increment 2

## Mission

Create the server-owned anonymous shopping-session foundation that follows Public Discovery and precedes Identity at Commitment.

Canonical commerce flow:

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

This increment owns only **Anonymous Shopping Session**.

## Planning and Working Authorities

- Issue #69 — Commerce Product Blueprint planning authority
- PR #72 — Public Single-store Product Discovery working area
- PR #74 — Partner Store Capability mainline reconstruction working area
- PR #48 — accepted ProductReservation and commerce-foundation evidence

No working-area PR is authorized to merge independently. Integration occurs only when the entire assigned Commerce Phase 1 agenda is complete.

## Product Goal

Allow a customer to start and maintain a lightweight shopping session without authentication while browsing one published storefront.

The session must be server-recognizable and resumable without creating customer identity, account ownership, order authority, payment authority, or stock reservation.

## Authority Boundary

`AnonymousShoppingSession` owns temporary pre-commit shopping intent.

It does not own:

- Customer identity
- authentication or OTP
- price authority
- stock authority
- ProductReservation
- Sale
- Payment
- Delivery
- OrderOnline

Server revalidation remains mandatory when the user later crosses the commitment boundary.

## Initial Data Contract

```text
AnonymousShoppingSession
- id
- publicTokenHash
- storefrontSlug
- status: ACTIVE | COMMITTED | EXPIRED | ABANDONED
- expiresAt
- lastActiveAt
- createdAt
- updatedAt

AnonymousShoppingSessionItem
- id
- sessionId
- productId
- quantity
- createdAt
- updatedAt
```

The durable record stores a hash of the public token, never the raw token.

## Behavioral Rules

1. A session belongs to one storefront context.
2. Browsing remains public and does not create a session automatically unless shopping intent begins.
3. Adding the first item creates or resumes an ACTIVE session.
4. Quantity must be a positive integer.
5. Session items record product intent only; they do not snapshot or own price.
6. No inventory is reserved during the anonymous stage.
7. Session expiry is independent from ProductReservation expiry.
8. A COMMITTED session cannot return to ACTIVE.
9. Identity binding is outside this increment.
10. Server revalidation is outside this increment but is a required later boundary.

## API Direction

Proposed public endpoints:

```text
POST   /api/sales/storefronts/:slug/session
GET    /api/sales/storefronts/:slug/session
PUT    /api/sales/storefronts/:slug/session/items/:productId
DELETE /api/sales/storefronts/:slug/session/items/:productId
DELETE /api/sales/storefronts/:slug/session
```

The raw session token is carried by a secure transport contract to be finalized during implementation. It must not be accepted as trusted business authority by itself.

## Privacy and Security

- no PII
- no customer account linkage
- no employee/user linkage
- no raw public token persisted
- no exact cost or internal inventory data exposed
- storefront context must be revalidated by the server
- mutation responses must remain customer-safe

## Explicit Non-goals

- OTP
- customer login or registration
- cart migration from legacy account-bound Cart
- reservation creation
- stock allocation
- payment
- checkout
- delivery address
- marketplace aggregation
- merge to `main`
- production deployment

## Delivery Policy

This is a Working Area increment.

- CI: not required by owner policy
- Test/Build before merge: not required by owner policy
- Runtime certification: deferred to owner-led Production validation after the full agenda is complete
- Merge: forbidden until all assigned Commerce Phase 1 work is complete

## Initial Gate State

- Product contract: CREATED
- Durable model: PENDING
- HTTP contract: PENDING
- Repository implementation: PENDING
- Repository review: PENDING
- Integration into Commerce Phase 1: PENDING
- Merge / Deploy / Production impact: NONE
