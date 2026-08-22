# Position-first Storefront / Marketplace Governance — Batch 3

## Scope

Batch 3 is stacked on Batch 2 and reuses the Store Experience capabilities introduced in Batch 1 rather than creating another overlapping capability family.

Covered partner-store runtime boundaries:

- GET `/api/partner-store/capability`
- PUT `/api/partner-store/capability`
- GET `/api/partner-store/online-products/visibility-audit`
- PATCH `/api/partner-store/online-products/:productId/price`

The onboarding and operational-readiness subrouters stay untouched because they own separate workflows and are mounted before this branch-settings authority boundary.

## Capability reuse

- `store-experience.read`
- `store-experience.manage`

Read endpoints require `store-experience.read`.
Mutation endpoints require both `store-experience.read` and `store-experience.manage`.

This intentionally avoids capability bloat: partner-store branch configuration, online-product visibility auditing and marketplace presentation controls are part of the same branch storefront/online experience authority already exposed to Position management.

## Compatibility

Historical partner-store capability routes allowed every authenticated employee-context role to read and mutate these settings. During migration:

- Position capabilities missing/null => OWNER / MANAGER / CASHIER / TECHNICIAN preserve historical access through the Batch 1 Store Experience compatibility mapping.
- Position capabilities non-null => explicit Store Experience capabilities are authoritative.
- `[]` => denied.
- Platform ADMIN/SUPERADMIN retain authority through the central resolver.

The employee/platform context check remains separate from business capability authorization and retains the old accepted context shape.

## Domain boundaries

Controllers continue to derive branch authority from the authenticated employee/user context and services retain their existing validation and persistence rules. This batch changes only feature authorization ownership at the route layer.

No Prisma migration is required.
