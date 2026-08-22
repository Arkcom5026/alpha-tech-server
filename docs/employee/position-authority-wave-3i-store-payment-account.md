# Position Authority Wave 3I — Store Payment Account

## Scope

Mounted runtime surface: `/api/finance/store-payment-accounts` via `financeRuntimeRoutes`.

Historical authority:
- list/detail: authenticated users
- create/update: platform `ADMIN` / `SUPERADMIN` through `requireAdmin`

## Authority alignment

This surface reuses the existing finance-bank capability family because store payment accounts are branch-owned payment/bank configuration rather than a separate financial transaction authority:

- `finance.bank.read`
- `finance.bank.manage`

Route matrix:
- `GET /` => `finance.bank.read`
- `GET /:id` => `finance.bank.read`
- `POST /` => migrated Position requires `finance.bank.read + finance.bank.manage`
- `PATCH /:id` => migrated Position requires `finance.bank.read + finance.bank.manage`

## Compatibility rule

Read compatibility follows Wave 3H bank semantics, preserving historical authenticated employee access while a Position remains legacy (`positionCapabilities == null`).

Mutation compatibility is intentionally stricter: historical employee roles never had create/update authority, so legacy OWNER/MANAGER/CASHIER/TECHNICIAN do not gain mutation access from their compatibility capability projection. Platform ADMIN/SUPERADMIN retain mutation authority. An explicitly migrated Position may opt into management by carrying both bank read and manage capabilities.

A non-null Position capability array remains authoritative, including `[]`.

## Boundaries preserved

- Parent `/api/finance` authentication remains unchanged.
- Controller branch ownership remains unchanged.
- Store payment account service/domain validation remains unchanged.
- No Prisma schema or migration changes.
