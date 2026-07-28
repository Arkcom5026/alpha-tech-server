# Partner Store Capability Foundation — Increment 3

## Mission
Establish branch-owned online-commerce policy independently from immutable order snapshots, then expose authenticated management, public projection, and checkout eligibility slices.

## Authority Boundary
- `PartnerStoreCapability` owns current mutable storefront and fulfillment policy for one branch.
- `PartnerStoreServiceArea` owns configured administrative delivery areas.
- `ProductReservation` owns the immutable agreement captured at order creation.
- Store policy changes must never rewrite existing orders.
- Online delivery fee values are server-derived for MARKETPLACE and STOREFRONT orders.

## Durable Capability
Each branch may configure storefront visibility, unique slug, display name, contact phone, pickup, delivery, delivery fee policy, service-area mode, preparation SLA, and fulfillment instructions.

Service-area modes:
- PICKUP_ONLY
- ADMIN_AREAS
- DISTANCE
- NATIONWIDE

Administrative area types:
- PROVINCE
- DISTRICT
- SUBDISTRICT
- POSTAL_CODE

## Implemented Runtime Slices
- Authenticated branch-scoped capability GET/PUT.
- Public read-only storefront projection by enabled slug.
- Checkout eligibility evaluation before online reservation creation.
- Server-derived immutable delivery-fee agreement snapshots.

## Authenticated Endpoints
- `GET /sales/reservations/store-capability`
- `PUT /sales/reservations/store-capability`

Branch authority is resolved only from authenticated user context. A request-body branch ID is never accepted as authority.

## Public Endpoint
- `GET /api/sales/storefronts/:slug`

The public projection exposes only customer-safe fields and never exposes branch IDs, capability IDs, internal timestamps, or policy mutation authority.

## Policy Validation
- At least one fulfillment method must remain enabled.
- Enabled storefront requires a valid lowercase slug.
- Delivery-disabled stores must use PICKUP_ONLY.
- Delivery-enabled stores require a delivery service-area mode.
- FIXED delivery requires a positive fee.
- ADMIN_AREAS requires at least one unique active area match.
- DISTANCE requires a positive maximum distance and a checkout distance value.
- NATIONWIDE does not require geographic narrowing.
- Preparation SLA must be positive.

## Persistence Behavior
- Capability upsert is transactional.
- Branch existence is locked and verified.
- Service-area replacement occurs in the same transaction.
- Existing ProductReservation snapshots are untouched.

## Safe Prisma Projection Workflow
The GitHub connector cannot safely patch selected lines of the 2,636-line Prisma schema without replacing the whole file. This increment therefore adds an idempotent, anchor-guarded local aligner:

- `scripts/align-online-commerce-prisma.js`
- `npm run prisma:align-online-commerce`
- `npm run verify:online-commerce-prisma`

The aligner projects only migration-owned elements:
- ProductReservation online-commerce fields and indexes.
- READY_TO_SHIP, SHIPPING, and DELIVERED lifecycle values.
- PartnerStoreCapability and PartnerStoreServiceArea models.
- OnlineOrderSource, OnlineFulfillmentMethod, OnlineDeliveryFeeMode, StoreServiceAreaMode, and StoreServiceAreaType enums.
- The required Branch relation.

It refuses to write when an expected anchor is missing or duplicated.

## Compatibility
- No existing branch is automatically published online.
- Default durable behavior remains storefront disabled, pickup enabled, and delivery disabled.
- Existing reservation lifecycle and Sale conversion behavior are preserved.
- Existing order snapshots are never rewritten from mutable store policy.

## Required Local Verification
Run in this order:

```bash
npm run prisma:align-online-commerce
npm run verify:online-commerce-prisma
npx prisma validate
npm run test:product-reservation
```

## Verification State
- Repository implementation for current online-commerce scope: complete.
- Safe Prisma projection aligner: implemented.
- Local aligner execution: not executed.
- Contract execution: not executed.
- Prisma validation: not executed.
- Migration execution, build, runtime, and operational verification: pending.

## Deferred
- Role-specific authorization beyond authenticated branch scope.
- Product-level online visibility.
- Public checkout write endpoint and customer identity authority.
- Address geocoding implementation.
- Opening hours and holidays.
