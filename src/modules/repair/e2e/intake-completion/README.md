# Repair Intake Completion E2E Package

This directory owns the Server side of the Repair Intake Completion Browser E2E certification.

## Files

- `repairIntakeE2ERuntimeAuthority.js` selects and guards the runtime authority.
- `provisionRepairIntakeFixture.js` creates a fresh RepairJob in `RECEIVED` with a DeviceIntake but without consent/photos.
- `verifyRepairIntakeOutcome.js` is read-only and verifies the final RepairJob, intake evidence, timeline, and tenant continuity.
- `repairIntakeFixture.contract.test.js` and `repairIntakeOutcome.contract.test.js` protect the fixture/verifier safety contract.
- `run-e2e-package.ps1` runs the module-local contracts and optional outcome verifier.

## Runtime modes

### Main-DB test tenant (daily Browser E2E)

Use the normal development Server connected through `DATABASE_URL`. Fixture writes are confined to the fixed test tenant:

- branchId: `13`
- slug: `test-shop`

Required environment:

- `REPAIR_INTAKE_E2E_DATABASE_MODE=MAIN_TEST_TENANT`
- `REPAIR_INTAKE_E2E_MAIN_DB_WRITE_APPROVAL=ALPHATECH_MAIN_DB_TEST_TENANT_WRITE`
- `REPAIR_INTAKE_E2E_ALLOWED_BRANCH_ID=13` (optional explicit assertion)
- `REPAIR_INTAKE_E2E_ALLOWED_BRANCH_SLUG=test-shop` (optional explicit assertion)
- `REPAIR_INTAKE_E2E_OPERATOR_EMAIL`
- `REPAIR_INTAKE_E2E_CUSTOMER_ID`

The configured operator must already be enabled, approved, active, and assigned to branch 13. Main-DB mode never changes operator credentials. The Browser runner still needs the operator's existing login password through its process environment.

Provision:

```powershell
$env:REPAIR_INTAKE_E2E_DATABASE_MODE='MAIN_TEST_TENANT'
$env:REPAIR_INTAKE_E2E_MAIN_DB_WRITE_APPROVAL='ALPHATECH_MAIN_DB_TEST_TENANT_WRITE'
$env:REPAIR_INTAKE_E2E_OPERATOR_EMAIL='...'
$env:REPAIR_INTAKE_E2E_CUSTOMER_ID='...'
node src/modules/repair/e2e/intake-completion/provisionRepairIntakeFixture.js
```

Keep the normal Server running with `npm run dev`. Copy the non-secret fixture values into the same PowerShell session used by the Client Browser runner, add `E2E_TEST_PASSWORD`, then run the Client package.

### Dedicated Test DB (database certification compatibility)

Set `REPAIR_INTAKE_E2E_DATABASE_MODE=TEST_DB` or omit the mode. This path retains `.env.restore`, `assertTestDatabaseAuthority`, explicit Test-DB write approval, and `npm run start:test-database`.

Required provisioning environment includes:

- `REPAIR_INTAKE_E2E_FIXTURE_APPROVAL=ALPHATECH_REPAIR_INTAKE_E2E_FIXTURE`
- `REPAIR_INTAKE_E2E_OPERATOR_EMAIL`
- `REPAIR_INTAKE_E2E_OPERATOR_PASSWORD`
- `REPAIR_INTAKE_E2E_CUSTOMER_ID`

## Outcome verification

After the Browser run:

```powershell
powershell -ExecutionPolicy Bypass -File src/modules/repair/e2e/intake-completion/run-e2e-package.ps1 -RepairJobId <id>
```

The verifier uses the same `REPAIR_INTAKE_E2E_DATABASE_MODE` as provisioning and never writes to the database.
