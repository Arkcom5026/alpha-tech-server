# Position-first Authority — Batch A Operational Residuals

## Baseline

Server main baseline: `8dbd9e33f3c68f8cb965119e0e493ffaf1a314a2`.
Client main baseline: `d2823dcbc2350072835b814c12e354ddaa955bdb`.

This batch intentionally groups several small residual boundaries so Local verification and publication do not need to happen once per endpoint.

## Included live boundaries

### Communication
- Historical behavior: authenticated employee can use communication operations; OWNER/MANAGER can additionally manage branch communication profiles.
- Position capabilities:
  - `communication.access`
  - `communication.profile.manage`
- Migrated `positionCapabilities = []` is authoritative and grants nothing.

### Store Experience
- Historical behavior: authenticated employee context can read/edit/publish storefront configuration and upload media.
- Position capabilities:
  - `store-experience.read`
  - `store-experience.manage`
  - `store-experience.publish`
- Read, edit/upload, and publish/unpublish are separated for migrated positions while legacy role compatibility preserves historical employee behavior.

### Product Trace
- Historical employee behavior: employee trace visibility is broadly available, while financial/supplier visibility is limited to OWNER/MANAGER and platform admins.
- Position capabilities:
  - `product.trace.read`
  - `product.trace.financial`
- Non-employee authenticated compatibility is not broadened; existing non-employee trace visibility remains read-only without financial visibility.

## Compatibility rules

- Platform ADMIN/SUPERADMIN retain all Batch A capabilities.
- Legacy OWNER/MANAGER preserve full Batch A access.
- Legacy CASHIER/TECHNICIAN preserve communication access, storefront operations, and non-financial product trace access.
- Legacy CASHIER/TECHNICIAN do not gain communication-profile management or product-trace financial visibility.
- A non-null Position capability array is authoritative, including an explicit empty array.

## Archaeology exclusions

Residual text matches are not automatically live authority boundaries. For example, legacy onboarding code still contains direct `v2Role` checks, but the mounted `/api/auth/add-sub-employee` path uses `employeeOnboardingRuntimeService`, which already gates creation through `employee.manage` and derives compatibility role from Position where available. That older service is therefore not modified in this batch without evidence that it is mounted.

Likewise, platform-only `requireAdmin` boundaries are not automatically converted to employee Position authority; each must be classified by runtime ownership and intended account authority before migration.

## Migration

No Prisma migration is required.
