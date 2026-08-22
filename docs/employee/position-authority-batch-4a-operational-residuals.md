# Position-first Authority — Batch 4A Operational Residuals

## Scope

This batch groups several remaining role-based operational boundaries so they can be integrated and verified locally once instead of publishing many small waves.

Included boundaries:

- Communication operational access and branch communication profile management.
- Product trace financial/supplier disclosure.
- Store Experience read, edit/media and publish/unpublish lifecycle.
- Employee onboarding authority alignment to the existing `employee.manage` capability.

## Capabilities

New capabilities:

- `communication.access`
- `communication.profile.manage`
- `product.trace.financials`
- `store-experience.read`
- `store-experience.manage`
- `store-experience.publish`

Existing capability reused:

- `employee.manage`

## Compatibility

Position capability arrays remain authoritative whenever they are non-null, including `[]`. Null/missing Position capabilities continue to use the existing v2Role compatibility mapping.

Legacy behavior is preserved while migration is incomplete:

- Communication: OWNER/MANAGER can access and manage profiles; CASHIER/TECHNICIAN retain normal operational communication access only.
- Product trace financial disclosure: OWNER/MANAGER retain disclosure; CASHIER/TECHNICIAN do not.
- Store Experience: OWNER/MANAGER/CASHIER/TECHNICIAN retain the historical employee-context behavior for read, edit/media and publish lifecycle.
- Employee onboarding: OWNER/MANAGER retain authority through `employee.manage`; CASHIER/TECHNICIAN do not.
- ADMIN/SUPERADMIN retain platform authority through the central Position resolver.

## Boundary ownership

Business capability decisions now resolve through `employeePositionAuthority`. Existing branch, employee-context, validation, repository, transaction and domain rules remain in their current owners.

Product trace authentication/read visibility is intentionally unchanged; this batch migrates only the financially sensitive disclosure boundary.

## Persistence

No Prisma schema or database migration is required.
