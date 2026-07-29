# Public Storefront — Current-main Reconstruction

## Mission

Reconstruct the public, read-only, single-store product discovery projection on top of current `main` after Partner Store Capability Foundation was merged through PR #79.

## Authority Chain

- Issue #71 — Commerce Platform Foundation
- Issue #90 — current agenda
- PR #79 — merged Partner Store Capability persistence/runtime authority
- PR #72 — historical implementation and contract evidence only
- PR #48 — historical product-decision evidence only

## Increment Policy

```text
One increment = one branch = one Draft PR
```

Branch:

```text
feature/public-storefront-current-main-reconstruction
```

Bootstrap main SHA:

```text
ccb34a71a95753946fef6b55d5054d7055e83316
```

## Product Direction

```text
Public Discovery
→ Anonymous Shopping Session
→ Identity at Commitment
→ Server Revalidation
→ ProductReservation
```

This increment owns only **Public Discovery**.

## Target Endpoint

```text
GET /api/sales/storefronts/:slug
```

The route must remain public and read-only.

## Projection Authorities

- PartnerStoreCapability
- Branch
- Product
- ProductImage
- BranchPrice.priceOnline
- StockBalance quantity/reserved

## Customer-safe Contract

Eligible response fields may include:

- storefront display name
- customer-safe contact information
- pickup/delivery discovery policy
- product id and name
- online price
- cover image
- warranty days
- qualitative availability

The projection must not expose exact stock quantity, cost, average cost, internal branch IDs, internal capability IDs, employee data, supplier data, or internal operational metadata.

## Publication Policy

A product is publishable only when:

- storefront capability is enabled
- storefront slug matches
- product is active
- branch price is active
- `priceOnline` is present and greater than zero
- effective/expiry windows permit publication

## Architecture Boundary

```text
Public Route
→ Controller
→ Service Policy
→ Repository Projection
→ Prisma
```

The storefront is a query projection, not a transaction aggregate.

## Reconstruction Policy

PR #72 is 102 commits behind current `main` and modifies old `server.js` ownership. Do not merge or rebase it wholesale.

Use PR #72 only for targeted evidence:

- public storefront route contract
- repository query intent
- customer-safe projection semantics
- focused contract test intent

All implementation must be reconstructed on this branch from current `main`.

## Explicit Non-goals

- Anonymous Shopping Session
- Anonymous Cart
- Customer Identity or OTP
- ProductReservation creation
- Checkout or payment
- Marketplace aggregation
- Merchant fulfillment UI
- Sale conversion
- Legacy OrderOnline replacement

## Verification Authority

Repository implementation will establish structural and contract evidence.

The project owner owns test execution, runtime endpoint verification, operational verification, exact tested SHA, migration application if ever required, and production verification.

## Initial State

```text
Agenda: OPEN
Repository working area: CREATED
Implementation: NOT STARTED
Repository Gate: OPEN
Runtime Gate: NOT STARTED — OWNER AUTHORITY
Operational impact: NONE
Production impact: NONE
```
