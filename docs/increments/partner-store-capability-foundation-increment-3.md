# Partner Store Capability Foundation — Increment 3

## Mission
Establish branch-owned online-commerce policy independently from immutable order snapshots, then expose an authenticated branch-scoped management slice.

## Authority Boundary
- `PartnerStoreCapability` owns current mutable storefront and fulfillment policy for one branch.
- `PartnerStoreServiceArea` owns configured administrative delivery areas.
- `ProductReservation` owns the immutable agreement captured at order creation.
- Store policy changes must never rewrite existing orders.

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

## Authenticated Vertical Slice
HTTP → Controller → Service → Repository → PostgreSQL is implemented under the existing authenticated Sales router.

Endpoints:
- `GET /sales/reservations/store-capability`
- `PUT /sales/reservations/store-capability`

Branch authority is resolved only from authenticated user context. A request-body branch ID is never accepted as authority.

## Policy Validation
- At least one fulfillment method must remain enabled.
- Enabled storefront requires a valid lowercase slug.
- Delivery-disabled stores must use PICKUP_ONLY.
- Delivery-enabled stores require a delivery service-area mode.
- FIXED delivery requires a positive fee.
- ADMIN_AREAS requires at least one unique area.
- DISTANCE requires a positive maximum distance.
- Preparation SLA must be positive.

## Persistence Behavior
- Upsert is transactional.
- Branch existence is locked and verified.
- Service-area replacement occurs in the same transaction.
- Existing ProductReservation snapshots are untouched.

## Compatibility
- No existing branch is automatically published online.
- Default durable behavior remains storefront disabled, pickup enabled, and delivery disabled.
- Existing reservation lifecycle and Sale conversion behavior are unchanged.

## Verification State
- Durable migration and repository contract: implemented.
- Authenticated branch-scoped read/write slice: implemented.
- Foundation and runtime contract tests are wired into `test:product-reservation`.
- Contract execution: not executed.
- Prisma projection alignment: pending safe full-file patch capability.
- Prisma validation, migration execution, build, runtime, and operational verification: pending.

## Deferred
- Role-specific authorization beyond authenticated branch scope.
- Public storefront projection.
- Checkout eligibility evaluation.
- Geocoding and distance calculation.
- Opening hours and holidays.
- Product-level online visibility.

## Next Highest-Value Target
Expose a read-only public storefront projection by enabled slug, returning only customer-safe current capability fields and never exposing internal branch policy mutation endpoints.
