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

Current implementation SHA:

```text
4583fb22fba9412601c53f1b33457563ca946ad0
```

## Implemented Scope

### Persistence foundation

- Additive Partner Store Capability migration
- Delivery-fee and service-area enums
- One capability row per branch
- Explicit service-area rows
- Foreign-key, uniqueness, consistency-check, and lookup-index authority
- Existing branches remain unpublished by default

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

### Repository verification wiring

- `tests/partner-store-capability-foundation.contract.test.js`
- `npm run test:partner-store-capability`

## Current Changed Files

```text
docs/increments/partner-store-capability-foundation-current-main.md
package.json
prisma/migrations/20260729143000_partner_store_capability_foundation/migration.sql
server.js
src/modules/partnerStore/controllers/partnerStoreCapabilityController.js
src/modules/partnerStore/repositories/partnerStoreCapabilityRepository.js
src/modules/partnerStore/routes/partnerStoreCapabilityRoutes.js
src/modules/partnerStore/services/partnerStoreCapabilityService.js
tests/partner-store-capability-foundation.contract.test.js
```

## Local Prisma Projection Evidence

Task Work previously completed targeted `prisma/schema.prisma` alignment locally at commit:

```text
948e74afadd34c9cfa2a8145e6bdcbfb39dfcfe2
```

Reported evidence:

```text
prisma validate: PASS
prisma generate: PASS
git diff --check: PASS
```

This local commit is not visible on the remote PR branch. Remote Prisma schema/migration alignment therefore remains pending repository evidence.

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
Internal Route → Controller → Service → Repository flow: IMPLEMENTED
Branch isolation design: IMPLEMENTED
Focused contract wiring: PASS
Remote Prisma schema/migration alignment: PENDING
Owner-supplied test evidence: PENDING
Repository Gate: PARTIAL
```

### Runtime Gate — Owner Authority

```text
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
Repository working area: OPEN
Implementation: PERSISTENCE + INTERNAL RUNTIME AUTHORITY IMPLEMENTED
Remote head SHA: 4583fb22fba9412601c53f1b33457563ca946ad0
Remote Prisma projection: PENDING
Repository Gate: PARTIAL
Runtime Gate: PENDING — OWNER AUTHORITY
Operational impact: NONE
Production impact: NONE
```

## Remaining Agenda

1. Make the Prisma schema projection visible on the remote PR branch.
2. Receive owner test and runtime evidence against an exact SHA.
3. Refresh PR #72 against the completed Partner Store Capability authority.
4. Keep PR #79 as Draft until evidence gates are satisfied.
5. Do not merge or deploy without explicit authorization.
