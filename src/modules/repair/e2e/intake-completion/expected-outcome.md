# Expected Outcome

The read-only verifier prints `result: PASS` only when all conditions hold:

- the fixture RepairJob exists in the expected branch;
- its status is `IN_PROGRESS`;
- its singular `deviceIntake` belongs to the same branch and RepairJob;
- consent exists with customer signature `Repair E2E Customer`;
- at least one `INTAKE_CONDITION` photo exists;
- a canonical workflow event records `ACCEPTED` to `REPAIRING`, while the compatible RepairJob status is `IN_PROGRESS`;
- no database mutation is performed by verification.

Any missing or cross-branch evidence produces `FAIL` with diagnostic details.
