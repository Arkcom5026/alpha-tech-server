# Position-first Authority — Batch 4 Operational Residuals

Status: IMPLEMENTED ON CLEAN FEATURE BRANCH / AWAITING LOCAL VERIFICATION

## Scope

This grouped batch migrates three remaining role-based operational boundaries together so they can be verified and published in one local cycle:

1. Communication
2. Store Experience / Storefront editor and media
3. Product Trace financial visibility

No Prisma schema or migration is required.

## Capabilities

### Communication
- `communication.use`
- `communication.profile.manage`

Historical compatibility:
- OWNER / MANAGER: use + profile management
- CASHIER / TECHNICIAN: use only
- platform ADMIN / SUPERADMIN: central capability resolver remains authoritative, while communication routes still require employee context
- migrated non-null Position capability arrays are authoritative, including `[]`

Existing operational semantics are preserved: customer channels, repair communication preferences and repair communication activities continue to use the normal communication-use boundary; only branch-level communication profile administration requires the elevated profile capability.

### Store Experience
- `store-experience.read`
- `store-experience.manage`
- `store-experience.publish`

Route matrix:
- GET draft / media: READ
- PUT draft and media upload: READ + MANAGE
- publish / unpublish: READ + MANAGE + PUBLISH

Historical compatibility deliberately grants all three capabilities to legacy OWNER / MANAGER / CASHIER / TECHNICIAN because these routes previously accepted any authenticated employee context for every action. Migrated Positions can now narrow that authority explicitly.

### Product Trace
- `product.trace.financial`

General authenticated Product Trace visibility is intentionally unchanged. This capability controls only financial / supplier-sensitive projection that was previously hard-coded to platform ADMIN / SUPERADMIN or legacy OWNER / MANAGER.

Historical compatibility:
- OWNER / MANAGER: financial visibility retained
- CASHIER / TECHNICIAN: no financial visibility
- platform ADMIN / SUPERADMIN: retained through central resolver
- migrated Positions: explicit capability required; `[]` denies financial projection even when legacy `v2Role` was OWNER / MANAGER

## Architectural rules

- Position capability arrays remain authoritative whenever non-null.
- `null` Position capabilities continue to use `v2Role` compatibility fallback.
- Communication uses one stable capability pair in the central Position authority; no parallel or duplicate residual resolver is introduced.
- No controller/service business-domain invariants are moved into the capability layer.
- No public storefront projection rules are changed.
- No Product Trace branch scoping or general authentication behavior is changed.
- Product Trace employee lookup uses the authenticated `employeeId` only and never treats a generic profile id as employee authority.

## Verification target

Local verification should run focused tests for Communication, Store Experience and Product Trace, then the existing Position-first contract, full server certification, Prisma validate, the grouped client UI contract, adjacent Position UI contracts, typecheck and production build before publication.
