# Position Authority Batch 4 — Residual Business Surfaces

## Scope

This batch migrates three remaining business surfaces away from direct role-name authority while preserving their historical compatibility semantics:

- Communication
- Store Experience
- Product Trace

The batch intentionally groups these small residual boundaries so they can be merged, verified, and published together instead of creating one Local verification cycle per endpoint.

## Capabilities

### Communication

- `communication.read`
- `communication.profile.manage`

Historical compatibility:

- Any authenticated employee could read communication data.
- OWNER / MANAGER could manage branch communication profiles.
- Migrated positions require explicit capabilities.
- `positionCapabilities = []` is authoritative and does not fall back to `v2Role`.

### Store Experience

- `store-experience.read`
- `store-experience.manage`
- `store-experience.publish`
- `store-experience.media`

Historical compatibility:

- The legacy Store Experience routes accepted any employee-profile context for draft, publish, unpublish, and media operations.
- That broad employee compatibility remains only while the position is still in legacy mode.
- Migrated positions separate read, draft management, publish lifecycle, and media authority explicitly.

Route matrix:

- GET draft / media list → READ
- PUT draft → READ + MANAGE
- POST publish / unpublish → READ + MANAGE + PUBLISH
- POST media upload → READ + MANAGE + MEDIA

### Product Trace

- `product.trace.read`
- `product.trace.financial`

Historical compatibility:

- Product trace read remained broadly available to the authenticated actor with valid branch context.
- Financial and supplier-sensitive trace projection was visible only to platform ADMIN/SUPERADMIN or legacy OWNER/MANAGER employees.
- Migrated positions require explicit READ and FINANCIAL capabilities.
- FINANCIAL does not imply READ; the request must first be authorized to view the trace.

## Authority ownership

- Communication keeps its existing communication policy as the feature authority owner, but that policy now delegates migrated-position decisions to the central Position resolver.
- Store Experience route middleware owns the draft/publish/media capability boundaries. Controllers and services retain branch/domain behavior.
- Product Trace keeps its existing projection policy as the feature authority owner because financial visibility is part of response redaction, not only route admission.

## Compatibility invariant

For every surface in this batch:

- `Position.capabilities = null` → legacy compatibility behavior.
- `Position.capabilities = []` → migrated Position with no authority.
- Any non-null capability array → Position is authoritative.
- ADMIN / SUPERADMIN keep platform authority through the central resolver.

## Persistence

No Prisma schema or migration change is required. Position capabilities remain JSON-backed authority configuration.
