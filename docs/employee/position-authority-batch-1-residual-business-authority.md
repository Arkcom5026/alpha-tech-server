# Position-first Residual Business Authority — Batch 1

## Scope

This batch intentionally groups several small residual role-based boundaries so Local verification and publication happen once at a meaningful checkpoint instead of once per endpoint.

Covered boundaries:

1. Communication operational access and communication-profile management.
2. Store Experience draft, media, publish and unpublish authority.
3. Product Trace financial/supplier visibility.

## Capability catalog

- `communication.operate`
- `communication.profile.manage`
- `store-experience.read`
- `store-experience.manage`
- `store-experience.publish`
- `product.trace.financials`

All six keys are registered in the central `employeePositionAuthority` catalog. A module-level residual authority adapter only narrows the central resolver to this batch; it does not implement a second role resolver.

## Compatibility rules

Position semantics remain authoritative:

- `positionCapabilities = null` or missing => legacy `v2Role` fallback.
- `positionCapabilities = []` => migrated position with no granted capability; no fallback.
- Any non-null Position capability array => Position is authoritative.
- Platform `ADMIN` and `SUPERADMIN` keep central all-capability authority.

Legacy behavior preserved during migration:

- OWNER / MANAGER: communication operate + profile manage, all Store Experience actions, Product Trace financial visibility.
- CASHIER / TECHNICIAN: communication operate and all historically available Store Experience actions, but not communication-profile management or Product Trace financial visibility.

## Route and policy boundaries

### Communication

Existing employee-context validation remains in `communicationRoutes`. `communicationAccessPolicy` now resolves `viewCommunication` from `communication.operate` and `manageCommunicationProfiles` from `communication.profile.manage`.

### Store Experience

The old inline business-role checks were removed from draft/media routes. Route authority is split as follows:

- GET draft / media => `store-experience.read`
- PUT draft / media upload => read + `store-experience.manage`
- publish / unpublish => read + manage + `store-experience.publish`

Historical employee/platform context shape is retained separately from capability authority.

### Product Trace

Base authenticated trace visibility is intentionally unchanged. This batch migrates only the sensitive financial/supplier projection boundary:

- `product.trace.financials` controls financial and supplier visibility.
- Legacy OWNER/MANAGER keep that visibility.
- Migrated positions must explicitly receive the capability.

## Persistence

No Prisma schema or migration change is required.

## Verification checkpoint

Before publication, run focused tests for residual authority, Communication, Store Experience and Product Trace, then the normal server certification suite and Prisma validation. On client, run the residual Position UI contract, adjacent Position authority contracts, typecheck and production build.
