# Position Authority Batch 4 — Residual Governance

## Scope

This grouped batch migrates four residual business-authority surfaces that still depended on legacy role checks, broad employee context, or an authority path weaker than the canonical Position-first path:

1. Communication
2. Store Experience / Storefront Draft + Media
3. Product Trace
4. Legacy Employee Management Mutations

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

## Legacy Employee Management Mutations

The canonical employee onboarding path already uses the established `employee.manage` Position capability. The older `/api/employees` mutation surface was weaker: create accepted any staff platform role and update/status were primarily branch-scoped.

Batch 4 aligns the live legacy mutation surface with the canonical authority:

- `POST /api/employees` => `employee.manage`
- `PUT /api/employees/:id` => `employee.manage`
- `PATCH /api/employees/:id/status` => `employee.manage`
- read endpoints remain unchanged
- `DELETE /api/employees/:id` remains hard-disabled and never becomes a Position delete permission

Compatibility:
- legacy OWNER / MANAGER retain management via the established central fallback
- legacy CASHIER / TECHNICIAN do not receive employee-management mutation authority
- migrated Position arrays require explicit `employee.manage`, including fail-closed `[]`
- platform ADMIN / SUPERADMIN retain authority

This intentionally removes the accidental historical over-breadth where an ordinary EMPLOYEE account category could reach the create mutation. It matches the already-authoritative onboarding policy rather than preserving a weaker compatibility bug.

## Position runtime

`positionRuntimeService` accepts this grouped residual capability catalog in addition to the established Position capability catalog so the client can persist these capabilities without weakening existing capability validation.

## Residuals deliberately deferred from this batch

Product pricing remains a live Position-first residual, but it is not folded into Batch 4. Its role matrix is called from many product creation, maintenance, Quick Stock, Quick Receipt, cloning and template-price paths, while several callers currently pass reduced actor objects without `positionCapabilities`. Migrating it safely requires one complete actor-continuity pass rather than a local policy-only edit.

Global/platform governance surfaces are also not converted merely because they still use `requireAdmin`:
- Branch mutation changes tenant boundaries and remains platform-admin governance.
- Category is shared/global taxonomy with system-category and GlobalProductType constraints.
- Product Template is a central/template-catalog governance surface.
- retired Product Profile routes remain retirement compatibility only.

## Non-goals

- No Prisma schema change or migration.
- No branch/tenant ownership changes.
- No changes to communication, storefront, product-trace, or employee domain data rules.
- No compatibility-field removal in this batch.
- No Product Pricing role-matrix migration in this batch.

## Verification checkpoint

Before publication, Local verification must include:

- grouped residual authority tests,
- communication policy tests,
- storefront authority tests,
- product trace policy tests,
- employee management authority tests,
- Position runtime residual-capability validation,
- Position-first authority regression,
- employee lifecycle runtime verification,
- full server certification,
- client grouped capability contract,
- client Position-first/onboarding regression,
- typecheck + production build,
- Prisma validate.
