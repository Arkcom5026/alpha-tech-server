# Mission

Provide Test-DB fixture and database post-condition authority for the Repair Intake Completion Browser E2E.

## Fixture state

- Same-store employee and customer authority are resolved from the Test DB.
- A unique external Device, DeviceIntake, and RepairJob are created.
- RepairJob begins in `RECEIVED`.
- DeviceIntake begins without consent and without photos.

## Accepted final state

- RepairJob is `IN_PROGRESS`.
- Consent exists and contains the Browser signature.
- At least one photo has category `INTAKE_CONDITION`.
- A `STATUS_CHANGED` event records `RECEIVED` → `IN_PROGRESS`.
- RepairJob, DeviceIntake, customer, device, event, and employee evidence remain in the fixture store authority.
