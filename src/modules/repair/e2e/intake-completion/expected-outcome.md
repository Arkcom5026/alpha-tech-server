# Expected Outcome

The read-only verifier prints `result: PASS` only when all conditions hold:

- the fixture RepairJob exists in the expected branch;
- its status is `IN_PROGRESS`;
- its singular `deviceIntake` belongs to the same branch and RepairJob;
- consent exists with customer signature `Repair E2E Customer`;
- at least one `INTAKE_CONDITION` photo exists;
- a status event records `RECEIVED` to `IN_PROGRESS`;
- no database mutation is performed by verification.

Any missing or cross-branch evidence produces `FAIL` with diagnostic details.
