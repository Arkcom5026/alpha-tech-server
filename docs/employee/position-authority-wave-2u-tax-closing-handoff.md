# Position-first Authority Wave 2U — Tax Closing Handoff

## Scope

Wave 2U migrates only the Tax Closing Handoff boundary to Position-first authority.

Covered routes:

- `GET /tax-periods/tax-closing-handoff/:taxPeriodId`
- `POST /tax-periods/tax-closing-handoff/:taxPeriodId/finalize`

The route prefix is whatever mount path currently owns `taxPeriodRoutes`; the boundary above refers to the module-local paths.

## Capabilities

- `tax.closing-handoff.read`
  - view the tax closing handoff bundle
- `tax.closing-handoff.finalize`
  - elevated authority to finalize the current handoff package

Finalize requires both `tax.closing-handoff.read` and `tax.closing-handoff.finalize`.

## Compatibility

Historical controller authority was restricted to platform `ADMIN` / `SUPERADMIN` or employee `OWNER` / `MANAGER`.

Compatibility is therefore preserved as follows:

- `OWNER`: read + finalize
- `MANAGER`: read + finalize
- `CASHIER`: none
- `TECHNICIAN`: none
- `ADMIN` / `SUPERADMIN`: all capabilities through system-role authority

For migrated Positions, a non-null `positionCapabilities` array is authoritative, including an empty array.

## Architecture

Wave 2U removes the employee-role decision from `taxClosingHandoffController` and moves authorization to a dedicated route middleware backed by the central Position capability registry.

The controller still owns branch validation and branch isolation. Non-system users remain unable to request another branch. The finalization service and handoff business logic are unchanged.

## Explicit exclusions

Wave 2U does not change:

- Accounting Office package
- Tax Readiness workspace
- VAT Settlement
- VAT Carry Forward
- Withholding Tax
- Tax Issuer Profile
- Tax Period core authority from Wave 2T
- Input Tax or Output Tax document/filing authority
- Delivery Note

## Migration

No Prisma schema or database migration is required.
