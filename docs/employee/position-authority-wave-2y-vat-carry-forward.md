# Position Authority Wave 2Y — VAT Carry Forward

## Scope

Wave 2Y migrates VAT carry-forward read and confirmation authority to Position-first authorization.

Affected endpoints:

- `GET /api/tax/periods/vat-carry-forward/:taxPeriodId`
- `POST /api/tax/periods/vat-carry-forward/:taxPeriodId/confirm`

Stable capabilities:

- `tax.vat-carry-forward.read`
- `tax.vat-carry-forward.confirm`

## Authority semantics

- `ADMIN` and `SUPERADMIN` remain platform-authorized.
- Legacy `OWNER` and `MANAGER` retain historical access through compatibility capability mapping.
- Legacy `CASHIER` and `TECHNICIAN` receive neither capability.
- A non-null `positionCapabilities` array is authoritative, including an empty array.
- Read access requires only `tax.vat-carry-forward.read`.
- Confirmation requires both `tax.vat-carry-forward.read` and `tax.vat-carry-forward.confirm`.
- The controller retains positive `branchId` validation, cross-branch isolation, request normalization, and actor projection.
- Route middleware owns Position capability authorization.

## Boundary

This wave intentionally does not migrate:

- Withholding-tax workspace or mutations.
- VAT settlement, tax readiness, accounting office package, tax closing handoff, or tax period authority already migrated in earlier waves.

No Prisma migration is required.

## Verification

Focused certification should include:

- `node src/modules/tax/settlement/vatCarryForwardAuthorization.test.js`
- `node src/modules/tax/settlement/vatSettlementAuthorization.test.js`
- `node src/modules/tax/readiness/taxReadinessAuthorization.test.js`
- `node src/modules/tax/accountingOffice/accountingOfficeAuthorization.test.js`
- `node scripts/verify-tax-authority-runtime.js`
- `node scripts/verify-employee-lifecycle-runtime.js`
- full `npm run test`
- `npx prisma validate`
