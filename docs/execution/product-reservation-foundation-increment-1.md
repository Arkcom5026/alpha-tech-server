# Product Reservation Foundation — Increment 1

## Mission
Establish the first safe backend foundation for product reservations initiated from the POS sales screen.

## Architecture Goal
Create a dedicated reservation authority that is separate from `Sale`, supports both stock-item and simple-product inventory, and can later convert atomically into the canonical Sales Completion flow.

## Scope
- Prisma reservation aggregate foundation
- Reservation lifecycle and inventory-allocation contracts
- Backend create-reservation vertical slice
- Runtime mount and authority verification
- Repository evidence for the increment

## Out of Scope
- Frontend reservation UI
- Reservation list/detail pages
- Deposit collection UI
- Conversion to Sale
- Cancellation and expiry execution
- Runtime and operational certification

## Authority Review
- [ ] Runtime owner remains singular
- [ ] No duplicate business logic
- [ ] No legacy reservation route is mounted
- [ ] No frontend legacy consumer exists
- [ ] No dead export
- [ ] No circular dependency
- [ ] No duplicate Prisma ownership
- [ ] Module boundaries remain valid

## Verification
- Repository Gate: IN PROGRESS
- Runtime Gate: PENDING LOCAL
- Operational Gate: PENDING

## Known Risks
- Existing Sales Completion atomic stock update must be hardened before reservations become active in production.
- Deposit authority remains hybrid and is intentionally not part of this increment.

## Merge Criteria
- Prisma schema is additive and valid by repository review.
- Reservation create path owns validation, transaction, inventory reservation, and evidence creation.
- Existing sale behavior is unchanged.
- Draft PR documents all verification and remaining risks.
