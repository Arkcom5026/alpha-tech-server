# Online Commerce Foundation Alignment — Increment 2

## Mission
Elevate the existing Product Reservation foundation into the single online order authority for Alpha-Tech local commerce without creating a competing order aggregate.

## Single Order Authority
`ProductReservation` is the Single Order Authority for Alpha-Tech local online commerce. Marketplace, partner storefront, Facebook, LINE, QR, phone, and other acquisition channels must create and operate through this authority rather than introducing a competing `OnlineOrder` aggregate.

## Product Direction
Customers may enter through the platform marketplace, a partner storefront, Facebook, LINE, QR, phone, or another channel. Every channel targets one explicitly selected branch whose POS inventory is the realtime stock authority.

## Implemented Foundation
- Online order source snapshot
- Pickup or delivery fulfillment method
- Free, fixed, or negotiated delivery fee agreement
- Recipient and delivery-address snapshots
- Branch existence verification before stock reservation
- Create and query contracts for online commerce fields
- Search and filtering by source and fulfillment method

## Fulfillment Lifecycle
Pickup orders:
- ACTIVE / PARTIALLY_PAID → READY_FOR_PICKUP

Delivery orders:
- ACTIVE / PARTIALLY_PAID → READY_TO_SHIP
- READY_TO_SHIP → SHIPPING
- SHIPPING → DELIVERED

Each transition:
- locks the order row with `FOR UPDATE`
- verifies active reservation items remain
- enforces the selected fulfillment method
- supports idempotent replay of the same target state
- rejects skipped or cross-method transitions

## Architecture Rules
- `ProductReservation` remains the current aggregate authority.
- Marketplace and storefront remain acquisition surfaces, not separate order domains.
- Sales Completion remains the sole Sale creation, payment, and stock-consumption authority.
- Realtime branch inventory remains authoritative.
- POS Hold Cart is outside this agenda.

## Repository Changes
- `prisma/migrations/20260728190000_online_commerce_foundation_alignment/migration.sql`
- `prisma/migrations/20260728203000_online_fulfillment_lifecycle/migration.sql`
- Create/query reservation slices
- Pickup lifecycle guard
- Delivery lifecycle repository/service/controller/routes
- Online commerce and fulfillment contract tests

## Verification State
- Repository implementation: COMPLETE for source, fulfillment, create/query, and lifecycle contracts
- Prisma projection alignment: completed locally; pending commit and push
- Prisma validate: PASS from local Task Work evidence
- Prisma generate: PASS from local Task Work evidence
- Contract test execution: rerun required after documentation contract repair
- Migration execution: NOT EXECUTED
- Build script: NOT AVAILABLE in package.json
- Runtime Gate: PENDING PRODUCTION DEPLOYMENT
- Operational Gate: PENDING PRODUCTION TEST

No runtime or certification PASS is claimed without evidence.
