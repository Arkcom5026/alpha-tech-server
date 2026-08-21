# Position-first Authority Wave 2W — Unified Tax Readiness

## Scope

Wave 2W migrates the read-only Unified Tax Readiness workspace to Position-first authority.

Route in scope:

- `GET /api/tax/periods/tax-readiness/:taxPeriodId`

Adjacent tax administration surfaces remain out of scope:

- VAT Settlement
- VAT Carry Forward
- Withholding Tax
- Accounting Office Package (Wave 2V)
- Tax Closing Handoff (Wave 2U)

## Capability

- `tax.readiness.read`

## Compatibility

Historical controller authority allowed platform `ADMIN`/`SUPERADMIN` and employee `OWNER`/`MANAGER` only. Wave 2W preserves that behavior for legacy positions:

- `OWNER`, `MANAGER` → capability granted through compatibility fallback
- `CASHIER`, `TECHNICIAN` → denied
- `ADMIN`, `SUPERADMIN` → system authority grants all capabilities
- Non-null Position capability arrays are authoritative, including `[]`

## Boundary

Route middleware now owns feature access through the centralized Position capability engine. The controller no longer interprets employee roles. It retains request validation and branch isolation, including platform-admin cross-branch behavior.

No Prisma migration is required. Unified readiness service composition and business logic are unchanged.
