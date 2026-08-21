# Position-first Authority Wave 2V — Accounting Office Package

## Scope

Wave 2V migrates the read-only Accounting Office Package surface to Position-first authority.

Route in scope:

- `GET /api/tax/periods/accounting-office/packages/:taxPeriodId`

Adjacent tax administration surfaces remain out of scope:

- Unified Tax Readiness
- VAT Settlement
- VAT Carry Forward
- Withholding Tax
- Tax Closing Handoff (already covered by Wave 2U)

## Capability

- `tax.accounting-office.read`

## Compatibility

Historical controller authority allowed platform `ADMIN`/`SUPERADMIN` and employee `OWNER`/`MANAGER` only. Wave 2V preserves that behavior for legacy positions:

- `OWNER`, `MANAGER` → capability granted through compatibility fallback
- `CASHIER`, `TECHNICIAN` → denied
- `ADMIN`, `SUPERADMIN` → system authority grants all capabilities
- Non-null Position capability arrays are authoritative, including `[]`

## Boundary

The route middleware now owns feature access through the centralized Position capability engine. The controller no longer interprets employee roles. It retains only request validation and branch isolation, including platform-admin cross-branch behavior.

No Prisma migration is required. Accounting Office package composition and withholding-tax readiness logic are unchanged.
