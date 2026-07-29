# Partner Store Capability Foundation — Current-main Reconstruction

## Mission

Reconstruct the minimum Partner Store Capability foundation on top of current `main` so Public Storefront PR #72 can become eligible for Repository, Runtime, and Operational certification without importing materially diverged history from Draft PR #48.

## Parent Authority

- Issue #71 — Commerce Platform Foundation
- Issue #78 — Partner Store Capability Foundation — Current-main Reconstruction
- PR #79 — current Working Area
- PR #72 — dependent Public Storefront Working Area
- PR #48 — historical contract and migration evidence only

## Increment Policy

```text
One increment = one branch = one Draft PR
```

Branch:

```text
feature/partner-store-capability-foundation
```

Base SHA at bootstrap:

```text
c38aef64e208fa9e627649ab084c3e348762465a
```

Repository implementation SHA:

```text
8284cacdd96cd62decb3afd4fbff0a42f766090e
```

## Implemented Scope

### Persistence foundation

- Additive Partner Store Capability migration
- Delivery-fee and service-area enums
- One capability row per branch
- Explicit service-area rows
- Foreign-key, uniqueness, consistency-check, and lookup-index authority
- Existing branches remain unpublished by default

### Prisma projection

Prisma 6 multi-file schema support is enabled through:

```json
{
  "prisma": {
    "schema": "prisma"
  }
}
```

Domain projection:

```text
prisma/partner-store-capability.prisma
```

The projection defines:

- `PartnerStoreCapability`
- `PartnerStoreServiceArea`
- `OnlineDeliveryFeeMode`
- `StoreServiceAreaMode`
- `StoreServiceAreaType`
- one-to-many capability/service-area relation
- uniqueness and lookup indexes aligned with the migration

### Internal runtime authority

```text
GET /api/partner-store/capability
PUT /api/partner-store/capability

verifyToken
→ employee-context guard
→ controller
→ policy service
→ repository
→ Prisma
```

Runtime files:

```text
src/modules/partnerStore/controllers/partnerStoreCapabilityController.js
src/modules/partnerStore/repositories/partnerStoreCapabilityRepository.js
src/modules/partnerStore/routes/partnerStoreCapabilityRoutes.js
src/modules/partnerStore/services/partnerStoreCapabilityService.js
```

Runtime mount:

```text
/api/partner-store
```

### Branch authority

Branch scope is derived only from authenticated employee context:

```text
req.employee.branchId
or
req.user.branchId
```

The runtime does not accept `branchId` from URL parameters or request payloads.

### Runtime policy authority

- Enabled storefront requires a non-empty storefront slug.
- Disabled delivery requires `PICKUP_ONLY`.
- Enabled delivery requires a delivery fee mode and a non-pickup service-area mode.
- `FIXED` delivery requires a positive fixed fee.
- Fixed fee is rejected for non-`FIXED` modes.
- `DISTANCE` service requires a positive maximum distance.
- Maximum distance is rejected outside `DISTANCE` mode.
- `ADMIN_AREAS` requires at least one service-area row.
- Service-area rows are rejected outside `ADMIN_AREAS` mode.
- Duplicate service-area identity is rejected by `areaType + areaCode`.
- Capability upsert and service-area replacement execute in one transaction.

### Repository contract authority

`tests/partner-store-capability-foundation.contract.test.js` now verifies:

- migration enums, tables, constraints, indexes, and additive scope
- Prisma multi-file schema configuration
- Prisma models, enums, relation, uniqueness, and indexes
- server route mount
- GET/PUT endpoint wiring
- authentication and employee-context middleware
- branch isolation at the controller boundary
- service policy ownership and transaction use
- repository Prisma delegate usage
- reservation and legacy online-order non-interference

Command:

```text
npm run test:partner-store-capability
```

## Current Changed Files

```text
docs/increments/partner-store-capability-foundation-current-main.md
package.json
prisma/partner-store-capability.prisma
prisma/migrations/20260729143000_partner_store_capability_foundation/migration.sql
server.js
src/modules/partnerStore/controllers/partnerStoreCapabilityController.js
src/modules/partnerStore/repositories/partnerStoreCapabilityRepository.js
src/modules/partnerStore/routes/partnerStoreCapabilityRoutes.js
src/modules/partnerStore/services/partnerStoreCapabilityService.js
tests/partner-store-capability-foundation.contract.test.js
```

## Testing Authority

The project owner owns:

- Test execution
- Runtime verification
- Representative migration application
- Operational verification
- Exact tested-SHA certification

Repository implementation must not claim Runtime PASS, Operational PASS, or Production readiness without owner-supplied evidence.

## Explicit Non-goals

- Public storefront query implementation
- ProductReservation lifecycle redesign
- Anonymous Shopping Session
- Anonymous Cart
- OTP or Customer Identity
- Checkout or payment
- Marketplace
- Merchant fulfillment UI
- Sale conversion
- Legacy OrderOnline replacement

Public customer exposure remains owned by PR #72.

## Safety Constraints

1. Do not merge, rebase, or import PR #48 wholesale.
2. Apply targeted reconstruction only.
3. Migration remains additive and non-destructive.
4. Existing commerce transaction authority remains unchanged.
5. Do not introduce a competing Storefront or reservation aggregate.
6. Branch scope must remain enforceable through authenticated employee context.
7. Public data exposure remains owned by PR #72.
8. Do not deploy or apply production migrations without separate authorization.

## Gate State

### Repository Gate

```text
Targeted file scope: PASS
Authority semantics documented: PASS
Unrelated PR #48 history excluded: PASS
Additive/non-destructive migration review: PASS
Prisma schema/migration alignment: IMPLEMENTED
Internal Route → Controller → Service → Repository flow: IMPLEMENTED
Branch isolation design: IMPLEMENTED
Focused repository contract: COMPLETE
Repository Implementation: COMPLETE
Owner-supplied test evidence: PENDING
```

### Runtime Gate — Owner Authority

```text
Prisma validate and generate: PENDING ON CURRENT REMOTE SHA
Migration apply against representative database: PENDING
Focused foundation tests: PENDING
Create/read/update policy behavior: PENDING
Branch isolation behavior: PENDING
Enum and service-area behavior: PENDING
Exact tested SHA: PENDING
Runtime Gate: PENDING
```

### Operational Enablement

This foundation has no independent customer UI gate. Its operational value is certified by enabling PR #72:

```text
GET /api/sales/storefronts/:slug
→ Partner Store Capability
→ Product / Price / Inventory projection
→ customer-safe public response
```

## Current State

```text
Repository working area: IMPLEMENTATION COMPLETE
Repository implementation SHA: 8284cacdd96cd62decb3afd4fbff0a42f766090e
Remote Prisma projection: IMPLEMENTED
Repository Implementation: COMPLETE
Runtime Gate: PENDING — OWNER AUTHORITY
Operational impact: NONE
Production impact: NONE
```

## Remaining Agenda Before Merge

1. Project owner runs Prisma validate/generate and focused/runtime verification against the final remote SHA.
2. Record exact tested SHA and evidence in PR #79.
3. Review merge readiness and merge only under explicit owner authorization.
4. Open the next agenda for refreshing PR #72 after PR #79 is merged.
5. Do not deploy or apply production migrations without separate authorization.
