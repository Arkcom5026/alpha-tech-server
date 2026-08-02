# Repair Intake Completion Test-DB Package

This directory owns the Server side of the Repair Intake Completion E2E certification.

## Files

- `provisionRepairIntakeFixture.js` creates a fresh Test-DB-only RepairJob in `RECEIVED` with a DeviceIntake but without consent/photos.
- `verifyRepairIntakeOutcome.js` is read-only and verifies the final RepairJob, intake evidence, timeline, and tenant continuity.
- `repairIntakeFixture.contract.test.js` and `repairIntakeOutcome.contract.test.js` protect the fixture/verifier safety contract.
- `run-e2e-package.ps1` provides the module-local command sequence.

## Safety

Provisioning requires `.env.restore`, Test Database authority, an explicit approval token, and a known same-branch customer ID. The verifier never writes.

## Required provisioning environment

- `REPAIR_INTAKE_E2E_FIXTURE_APPROVAL=ALPHATECH_REPAIR_INTAKE_E2E_FIXTURE`
- `REPAIR_INTAKE_E2E_OPERATOR_EMAIL`
- `REPAIR_INTAKE_E2E_OPERATOR_PASSWORD`
- `REPAIR_INTAKE_E2E_CUSTOMER_ID`

The fixture prints the Browser environment and a run token for the read-only verifier.
