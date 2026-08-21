# Position Authority Wave 3H — Bank Master Data

## Scope

Wave 3H moves the mounted `/api/banks` surface from authenticated-only access to Position-first capability authority without changing bank business rules or persistence semantics.

## Archaeology

`server.js` mounts `src/modules/finance/bank/routes/bankRoutes.js` at `/api/banks`.

Before this wave the router only applied `verifyToken`, so every authenticated employee role historically had list, detail, create, update, and delete access. Controllers already retain branch isolation and validation. Delete remains a physical delete and fails closed when foreign-key references exist.

## Capabilities

- `finance.bank.read`
- `finance.bank.manage`
- `finance.bank.delete`

## Route matrix

- `GET /api/banks` -> READ
- `GET /api/banks/:id` -> READ
- `POST /api/banks` -> READ + MANAGE
- `PATCH /api/banks/:id` -> READ + MANAGE
- `DELETE /api/banks/:id` -> READ + MANAGE + DELETE

Delete is intentionally separated because it is destructive and may be blocked by existing references.

## Compatibility

The old router was authenticated-only. During migration, legacy OWNER, MANAGER, CASHIER, and TECHNICIAN roles therefore retain READ + MANAGE + DELETE when Position capabilities are null/missing.

A non-null Position capability array is authoritative, including `[]`. There is no fallback from an explicit migrated Position back to `v2Role`.

ADMIN and SUPERADMIN retain all Position capabilities through the shared system-role authority.

## Boundary ownership

Route middleware owns feature authorization. Bank controllers retain branch isolation, input validation, duplicate-name checks, not-found semantics, and foreign-key delete protection.

No Prisma schema or migration is required.
