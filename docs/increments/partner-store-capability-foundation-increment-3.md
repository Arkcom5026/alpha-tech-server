# Partner Store Capability Foundation — Increment 3

## Mission
Establish branch-owned online commerce policy without coupling mutable store configuration to immutable order snapshots.

## Authority Boundary
- `PartnerStoreCapability` owns current storefront and fulfillment policy for one branch.
- `PartnerStoreServiceArea` owns the configured administrative delivery areas.
- `ProductReservation` continues to own the source, fulfillment method, recipient, address, and delivery-fee agreement captured when the order is created.
- Changing store policy must never rewrite existing orders.

## Capability Projection
Each branch may configure:
- storefront visibility and unique storefront slug
- customer-facing display name and contact phone
- pickup availability
- delivery availability
- delivery fee mode: FREE, FIXED, or NEGOTIATED
- fixed delivery fee when applicable
- service-area mode: PICKUP_ONLY, ADMIN_AREAS, DISTANCE, or NATIONWIDE
- maximum delivery distance for distance-based service
- preparation SLA in minutes
- pickup and delivery instructions

## Service Areas
Administrative service areas are represented as separate durable rows supporting:
- PROVINCE
- DISTRICT
- SUBDISTRICT
- POSTAL_CODE

The unique capability/type/code contract prevents duplicate active policy entries and supports future marketplace coverage queries.

## Database Guards
- One capability row per branch.
- Delivery-disabled stores cannot retain delivery fee or delivery-zone configuration.
- Delivery-enabled stores require a fee mode and a non-pickup service-area mode.
- FIXED delivery requires a positive fee.
- Non-FIXED delivery cannot retain a fixed fee.
- DISTANCE mode requires a positive maximum distance.
- Non-DISTANCE modes cannot retain a maximum distance.
- Preparation SLA must be positive when supplied.

## Compatibility
- No existing branch is automatically published online.
- Default behavior is storefront disabled, pickup enabled, and delivery disabled.
- Existing order rows and reservation lifecycle behavior are unchanged.

## Deferred Runtime Scope
This increment establishes durable policy authority only. The following remain separate increments:
- authenticated capability create/update/query endpoints
- public storefront query projection
- checkout eligibility evaluation against current store policy
- geographic distance calculation and address geocoding
- opening hours and holiday exceptions
- product-level online visibility

## Verification State
- Migration and repository contract: implemented.
- Contract execution: not executed.
- Prisma projection alignment: pending safe full-file patch capability.
- Migration execution, build, runtime, and operational verification: pending.
