# Position Authority Wave 2X — VAT Settlement

## Scope

Wave 2X migrates the VAT settlement preparation workspace to Position-first authority.

Affected endpoint:

- `GET /api/tax/periods/vat-settlement/:taxPeriodId`

Stable capability:

- `tax.vat-settlement.read`

## Authority semantics

- `ADMIN` and `SUPERADMIN` remain platform-authorized.
- Legacy `OWNER` and `MANAGER` retain historical access through the compatibility capability mapping.
- Legacy `CASHIER` and `TECHNICIAN` do not receive this capability.
- If `positionCapabilities` is a non-null array, Position authority is authoritative, including an empty array.
- The controller continues to own positive `branchId` validation and cross-branch isolation.
- The route middleware owns Position capability authorization.

## Boundary

This wave intentionally does not migrate:

- VAT carry-forward authority or confirmation.
- Withholding-tax workspace or mutations.
- Tax period, tax readiness, accounting office package, or tax closing handoff authority already migrated in earlier waves.

No Prisma migration is required.

## Verification

Focused certification should include:

- `node src/modules/tax/settlement/vatSettlementAuthorization.test.js`
- `node src/modules/tax/readiness/taxReadinessAuthorization.test.js`
- `node src/modules/tax/accountingOffice/accountingOfficeAuthorization.test.js`
- `node scripts/verify-tax-authority-runtime.js`
- `node scripts/verify-employee-lifecycle-runtime.js`
- full `npm run test`
- `npx prisma validate`
