# Position Authority Wave 2Z — Withholding Tax

## Scope

Wave 2Z migrates the Withholding Tax workspace and mutations to Position-first authority.

Affected endpoints:

- `GET /api/tax/periods/withholding-tax/:taxPeriodId`
- `POST /api/tax/periods/withholding-tax/items/:taxExpenseItemId/treatment`
- `POST /api/tax/periods/withholding-tax/:taxPeriodId/certificates/issue`
- `POST /api/tax/periods/withholding-tax/:taxPeriodId/filings/:formType/prepare`
- `POST /api/tax/periods/withholding-tax/:taxPeriodId/filings/:formType/submit`

Stable capabilities:

- `tax.withholding.read`
- `tax.withholding.treatment`
- `tax.withholding.certificate.issue`
- `tax.withholding.filing.prepare`
- `tax.withholding.filing.submit`

## Authority semantics

- `ADMIN` and `SUPERADMIN` remain platform-authorized.
- Legacy `OWNER` and `MANAGER` retain historical access through compatibility capability mapping.
- Legacy `CASHIER` and `TECHNICIAN` do not receive Withholding Tax capabilities.
- If `positionCapabilities` is a non-null array, Position authority is authoritative, including an empty array.
- Workspace read requires `tax.withholding.read`.
- Treatment transition requires read + `tax.withholding.treatment`.
- Certificate issuance requires read + `tax.withholding.certificate.issue`.
- Filing preparation requires read + `tax.withholding.filing.prepare`.
- Filing submission requires read + filing prepare + `tax.withholding.filing.submit`.

## Boundary

Route middleware owns feature capability authorization.

The controller continues to own:

- positive `branchId` validation,
- cross-branch isolation,
- authenticated employee actor projection,
- submitted-period immutability before filing preparation.

The service keeps all existing tax-period, certificate, filing, transactional, and statutory validation semantics.

No Prisma migration is required.

## Verification

Focused certification should include:

- `node src/modules/tax/withholdingTax/withholdingTaxAuthorization.test.js`
- `node src/modules/tax/settlement/vatCarryForwardAuthorization.test.js`
- `node src/modules/tax/settlement/vatSettlementAuthorization.test.js`
- `node src/modules/tax/readiness/taxReadinessAuthorization.test.js`
- `node src/modules/tax/accountingOffice/accountingOfficeAuthorization.test.js`
- `node scripts/verify-tax-authority-runtime.js`
- `node scripts/verify-employee-lifecycle-runtime.js`
- full `npm run test`
- `npx prisma validate`
