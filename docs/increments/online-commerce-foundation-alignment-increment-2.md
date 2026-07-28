# Online Commerce Foundation Alignment — Increment 2

## Mission
Elevate the existing Product Reservation foundation into the single backend order authority for Alpha-Tech local online commerce while preserving canonical Sales Completion and existing reservation inventory guarantees.

## Product Direction
Customers may enter through the platform marketplace, a partner storefront, Facebook, LINE, QR, phone, or another channel. Every channel must create the same order authority and must target one explicitly selected branch whose POS inventory is the realtime stock authority.

## Scope
- Additive database projection for online order source.
- Additive fulfillment selection: pickup or delivery.
- Delivery fee agreement projection supporting free, fixed, or negotiated delivery.
- Recipient and delivery-address snapshot fields.
- Preserve existing reservation lifecycle, stock allocation, cancellation, expiry, and conversion behavior.

## Architecture Rules
- `ProductReservation` remains the current aggregate and migration authority; no competing `OnlineOrder` aggregate is introduced in this increment.
- Marketplace and storefront are acquisition surfaces, not separate order domains.
- Branch selection remains mandatory and authoritative.
- Sales Completion remains the only Sale creation/payment/stock-consumption authority.
- Delivery policy configuration and geographic service zones are deferred to store capability increments; this increment only snapshots the selected checkout agreement.
- POS Hold Cart is explicitly out of scope and will be opened as a separate Sales-module agenda.

## Added Projection
- `OnlineOrderSource`: MARKETPLACE, STOREFRONT, FACEBOOK, LINE, QR, PHONE, OTHER.
- `OnlineFulfillmentMethod`: PICKUP, DELIVERY.
- `OnlineDeliveryFeeMode`: FREE, FIXED, NEGOTIATED.
- Source reference, recipient contact, delivery address, delivery note, and delivery fee snapshot.

## Compatibility
Existing reservation rows project as STOREFRONT + PICKUP with zero delivery fee. Existing pickup behavior remains unchanged.

## Verification State
- Repository Gate: implementation in progress.
- Prisma validation: not executed.
- Migration execution: not executed.
- Tests/build/runtime: not executed.
- Runtime and Operational Gates remain pending production deployment.
