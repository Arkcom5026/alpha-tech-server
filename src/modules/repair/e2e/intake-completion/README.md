# Repair Intake Completion Test-DB Package

This directory owns the Server side of the Repair Intake Completion E2E certification.

## Files

- `provisionRepairIntakeFixture.js` creates a fresh Test-DB-only RepairJob in `RECEIVED` with a DeviceIntake but without consent/photos.
- `verifyRepairIntakeOutcome.js` is read-only and verifies the final RepairJob, intake evidence, timeline, and tenant continuity.
- `repairIntakeFixture.contract.test.js` and `repairIntakeOutcome.contract.test.js` protect the fixture/verifier safety contract.
- `run-e2e-package.ps1` provides the module-local contract and outcome-verifier sequence.

## Safety

Provisioning requires `.env.restore`, Test Database authority, an explicit approval token, and a known same-branch customer ID. The verifier never writes.

## Required provisioning environment

- `REPAIR_INTAKE_E2E_FIXTURE_APPROVAL=ALPHATECH_REPAIR_INTAKE_E2E_FIXTURE`
- `REPAIR_INTAKE_E2E_OPERATOR_EMAIL`
- `REPAIR_INTAKE_E2E_OPERATOR_PASSWORD`
- `REPAIR_INTAKE_E2E_CUSTOMER_ID`

The fixture prints the non-secret Browser environment and a run token for the read-only verifier.

## Runtime authority

The Browser must call a Server process connected to the same dedicated Test DB used by the fixture. Do not use `npm run dev` for this E2E because it starts `server.js` with the normal `DATABASE_URL`, which may point to a different database and make a valid Test-DB fixture appear missing.

Stop any process already using port 3000, then start the Test API from the Server root:

```powershell
npm run start:test-database
```

`start:test-database` loads `.env.restore`, validates the Test Database authority, sets `DATABASE_URL` and `DIRECT_URL` to the Test DB target, marks the runtime as `TEST`, and starts `server.js` on `TEST_API_PORT` or port 3000.

Required `.env.restore` authority includes:

- `RESTORE_DATABASE_ENVIRONMENT=TEST`
- `RESTORE_DATABASE_PROJECT_REF=engqdeyzbvnmxbnpemau`
- `RESTORE_DATABASE_WRITE_APPROVAL=ALPHATECH_TEST_DB_WRITE`
- `RESTORE_DATABASE_URL` or `RECOVERY_DATABASE_URL` pointing to the dedicated Test DB

The Client Browser E2E should use `http://localhost:5173` and its API configuration must target the Test API process on port 3000.
