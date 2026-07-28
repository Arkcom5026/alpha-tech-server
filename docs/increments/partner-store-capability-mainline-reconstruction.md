# Partner Store Capability Mainline Reconstruction

## Mission

Reconstruct the minimum accepted Partner Store Capability foundation from Draft PR #48 on top of current `main`, without merging or rebasing the materially diverged branch.

This increment exists to create a current-main-compatible dependency authority for customer-facing commerce increments such as PR #72.

## Planning and Evidence Authorities

- Issue #69 — Commerce Product Blueprint planning authority
- PR #48 — accepted Product Reservation / Partner Store capability evidence and contracts
- PR #72 — dependent Public Single-store Product Discovery implementation

## Scope

This increment owns only the minimum durable and runtime foundation required for branch-owned storefront policy:

- commerce policy enums required by Partner Store Capability
- `PartnerStoreCapability`
- `PartnerStoreServiceArea`
- additive Prisma projection alignment
- authenticated branch-scoped policy management
- public read-only store-policy projection
- foundation and runtime contracts

## Explicit Non-goals

- ProductReservation reconstruction
- reservation commitment
- anonymous cart
- customer identity or OTP
- product discovery implementation from PR #72
- marketplace
- payment
- deployment or production migration

## Authority Boundary

- `PartnerStoreCapability` owns mutable current policy for one Branch.
- `PartnerStoreServiceArea` owns configured administrative delivery areas.
- Existing Product, BranchPrice, Inventory, Sales, and Customer authorities remain unchanged.
- Public storefront remains a read-only projection.
- No Storefront or MerchantCatalog transaction aggregate is introduced.

## Integration Safety

The reconstruction must be selective and additive.

Forbidden:

- merge PR #48 wholesale
- rebase this branch onto PR #48
- copy unrelated ProductReservation, Sales, Tax, Inventory, or Procurement changes
- rewrite existing migrations
- deploy to production without independent authorization

Required evidence before dependency PASS:

1. exact source evidence from PR #48
2. exact current-main base SHA
3. additive/non-destructive migration review
4. Prisma schema alignment
5. Prisma validate and generate
6. Partner Store foundation contracts
7. public store-policy projection contract
8. current-main compatibility review

## Gate Status

- Repository scope contract: CREATED
- Selective reconstruction: NOT STARTED
- Repository Gate: PENDING
- Runtime Gate: PENDING local execution
- Operational Gate: DEFERRED
- Migration execution / Deploy / Production impact: NOT AUTHORIZED / NONE
