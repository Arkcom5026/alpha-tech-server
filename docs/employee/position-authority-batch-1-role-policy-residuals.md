# Position-first Authority — Batch 1 Role-policy Residuals

## Scope

This batch migrates three remaining role-policy boundaries without changing their domain behavior:

- Communication
- Store Experience / storefront draft and media management
- Product Trace

## Capabilities

### Communication

- `communication.read`
- `communication.profile.manage`

Legacy compatibility:

- OWNER / MANAGER / CASHIER / TECHNICIAN keep communication read access.
- OWNER / MANAGER keep communication profile management access.
- Migrated non-null Position capability arrays are authoritative, including `[]`.
- ADMIN / SUPERADMIN keep platform authority.

### Store Experience

- `store-experience.manage`
- `store-experience.publish`

Route matrix:

- GET/PUT storefront draft => `store-experience.manage`
- GET/upload storefront media => `store-experience.manage`
- publish/unpublish => `store-experience.manage` + `store-experience.publish`

Legacy employee roles preserve historical access while migrated Positions require explicit capabilities.

### Product Trace

- `product.trace.read`
- `product.trace.financial`

`product.trace.financial` controls financial/supplier projections independently from basic trace visibility. Historical authenticated trace-read compatibility remains intact, while migrated Positions become capability-authoritative.

## Architecture

The batch uses `residualPositionAuthority.js` as a compatibility adapter over the existing central `resolveActorCapabilities()` semantics. It preserves the critical rule that `positionCapabilities = []` is authoritative and never falls back to `v2Role`.

No Prisma migration is required.
