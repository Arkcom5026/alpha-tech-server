# Position Authority Residual Batch 1

This batch continues the Position-first migration after Wave 3K while deliberately reducing Local merge/publish frequency.

## Included boundaries

### Communication
- `communication.use`
- `communication.profile.manage`
- Legacy employees retain historical communication usage.
- Legacy OWNER/MANAGER and platform admins retain profile-management authority.
- Migrated non-null Position capability arrays are authoritative, including `[]`.

### Product Trace
- `product.trace.read`
- `product.trace.financial.read`
- Authenticated non-employee trace behavior is preserved.
- Legacy employee roles retain historical trace read behavior; OWNER/MANAGER retain financial visibility.
- Migrated employee positions require explicit trace capabilities.

### Store Experience
- `store.experience.read`
- `store.experience.manage`
- `store.experience.publish`
- Historical legacy employee behavior is preserved while Position capabilities are null/missing.
- Migrated positions split read, edit/media and publish/unpublish authority.

## Authority rules
- Platform ADMIN/SUPERADMIN retain capability authority through the central Position resolver.
- `positionCapabilities = []` is authoritative and never falls back to `v2Role`.
- `null`/missing Position capabilities retain compatibility behavior until migration is complete.
- Controllers and domain services keep branch/business invariants; feature authority remains at policy/route boundaries.

## Schema impact

No Prisma migration is required.
