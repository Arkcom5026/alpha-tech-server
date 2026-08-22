# Position Authority Batch 4 — Residual Governance

## Scope

This grouped batch migrates three residual business-authority surfaces that still depended on legacy role checks or broad employee context:

1. Communication
2. Store Experience / Storefront Draft + Media
3. Product Trace

The batch intentionally groups related residual policies so Local verification and publication can happen once at a meaningful checkpoint instead of once per endpoint.

## Capabilities

### Communication

- `communication.read`
- `communication.operate`
- `communication.profile.manage`

Route intent:
- GET communication data requires `communication.read`.
- Customer-channel, repair-preference, and repair-activity writes require `communication.read` + `communication.operate`.
- Communication profile mutation requires `communication.read` + `communication.profile.manage`.

Legacy compatibility:
- Existing employees retain read + operate.
- Legacy OWNER / MANAGER retain profile management.
- Migrated Position arrays are authoritative, including `[]`.

## Store Experience

- `store-experience.read`
- `store-experience.manage`
- `store-experience.publish`

Route intent:
- Draft/media reads require READ.
- Draft mutation and media upload require READ + MANAGE.
- Publish/unpublish require READ + MANAGE + PUBLISH.

Legacy compatibility:
- Historically any validated employee context could manage and publish this surface; legacy employee fallback therefore preserves all three capabilities.
- Migrated Positions may separate these responsibilities explicitly.

## Product Trace

- `product.trace.read`
- `product.trace.financials`

Policy intent:
- Trace visibility becomes explicit for migrated Positions.
- Supplier/financial visibility is separated from ordinary trace visibility.

Legacy compatibility:
- Existing branch-authorized employees retain trace visibility.
- Legacy OWNER / MANAGER retain financial visibility.
- Platform ADMIN / SUPERADMIN retain complete authority.
- Migrated `positionCapabilities = []` fails closed.

## Position runtime

`positionRuntimeService` accepts this grouped capability catalog in addition to the established Position capability catalog so the client can persist these capabilities without weakening existing capability validation.

## Non-goals

- No Prisma schema change or migration.
- No branch/tenant ownership changes.
- No changes to communication, storefront, or product-trace domain data rules.
- No compatibility-field removal in this batch.

## Verification checkpoint

Before publication, Local verification must include:

- grouped residual authority tests,
- communication policy tests,
- storefront authority tests,
- product trace policy tests,
- Position-first authority regression,
- full server certification,
- client grouped capability contract,
- client Position-first/onboarding regression,
- typecheck + production build,
- Prisma validate.
