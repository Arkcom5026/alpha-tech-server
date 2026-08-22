# Position Authority Batch 4A — Communication, Store Experience, Product Trace

## Scope

This batch migrates three residual role-based authority boundaries to Position-first capabilities while preserving legacy compatibility until each Position has an explicit capability array.

### Communication

Capabilities:
- `communication.access`
- `communication.profile.manage`

Legacy compatibility:
- OWNER / MANAGER: access + profile management
- CASHIER / TECHNICIAN: access only
- ADMIN / SUPERADMIN: platform authority remains available when employee context is valid

Migrated Position behavior:
- non-null `positionCapabilities` is authoritative, including `[]`
- communication access requires `communication.access`
- branch communication profile mutation additionally requires `communication.profile.manage`

### Store Experience

Capability:
- `store-experience.manage`

The existing Store Experience surface historically allowed authenticated employee contexts to read/save drafts, publish/unpublish and manage storefront media. During migration OWNER / MANAGER / CASHIER / TECHNICIAN therefore retain this behavior through compatibility fallback. Migrated Positions require the explicit capability.

### Product Trace financial visibility

Capability:
- `product.trace.financials`

Base Product Trace visibility is intentionally unchanged. Only the role-based financial/supplier projection is migrated:
- legacy OWNER / MANAGER retain financial visibility
- legacy CASHIER / TECHNICIAN remain non-financial
- migrated Positions require the explicit capability
- ADMIN / SUPERADMIN retain platform authority

## Boundaries intentionally unchanged

- Communication branch/customer/repair isolation remains in the existing route/service layer.
- Store Experience draft/media business behavior is unchanged.
- Product Trace base authenticated visibility and branch-scoped lookup are unchanged.
- No Prisma schema or migration is required.

## Verification intent

Focused tests cover legacy fallback, migrated Position authority including authoritative empty arrays, platform administration, and non-employee denial where historically required. Full server certification and client typecheck/build remain the Local integration gate for this batch.
