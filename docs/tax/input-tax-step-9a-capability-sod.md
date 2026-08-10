# Input Tax Step 9A — Capability and Separation-of-Duties Policy

## Authority model audited

Current repository authority exposes these persisted roles only:

- Account roles: `CUSTOMER`, `EMPLOYEE`, `ADMIN`, `SUPERADMIN`
- Employee roles: `OWNER`, `MANAGER`, `CASHIER`

There is no persisted `ACCOUNTING` or `TAX` role. Step 9A therefore does not invent one.

`verifyToken` refreshes User and EmployeeProfile state from the database and projects authenticated `role`, `employeeRole`, `employeeId`, and `branchId` into `req.user`.

## Capability matrix

| Capability | SUPERADMIN | ADMIN | OWNER | MANAGER | CASHIER | CUSTOMER |
| --- | --- | --- | --- | --- | --- | --- |
| View Input Tax | allow | allow | allow | allow | deny | deny |
| Review | allow | allow | allow | allow | deny | deny |
| Duplicate decision | allow | allow | allow | allow | deny | deny |
| Replacement decision | allow | allow | allow | allow | deny | deny |
| Select for filing | allow | allow | allow | allow | deny | deny |
| Remove from filing | allow | allow | allow | allow | deny | deny |
| File/submit batch | allow | allow | allow | allow | deny | deny |
| Reopen period | allow | allow | allow | allow | deny | deny |
| Export | allow | allow | allow | allow | deny | deny |
| Generate audit package | allow | allow | allow | allow | deny | deny |
| Resolve investigation | allow | allow | allow | allow | deny | deny |

This matrix preserves the role model already enforced by tax controllers. It is intentionally coarse until the product introduces a persisted accounting/tax capability model through a separate approved agenda.

## Backend enforcement

`src/modules/tax/policies/inputTaxAccessPolicy.js` is the Step 9A backend policy authority.

For high-impact Input Tax mutations it requires:

1. authenticated role authority;
2. explicit capability;
3. positive requested branch;
4. branch isolation for non-admin actors;
5. authenticated employee actor identity.

Frontend visibility or disabled buttons are never authorization authority.

## Separation of duties

The current schema does not persist an immutable TaxDocument creator/reviewer/filer tuple that can support a reliable maker-checker rule without inferring identity from mutable snapshots or historical events. Step 9A therefore does **not** invent a false SoD rule.

The minimal enforceable policy is:

- cashier/customer cannot execute high-impact tax decisions;
- every high-impact mutation requires an authenticated employee actor;
- branch-local OWNER/MANAGER authority is enforced;
- ADMIN/SUPERADMIN retain cross-branch administrative authority;
- duplicate and replacement decisions record actor employee identity in lifecycle evidence.

A strict rule such as `creator != reviewer != filer` is deferred until the repository has explicit persisted role/capability and actor-stage authority. Adding such persistence requires its own Prisma/migration authority review.

## Shared TaxPeriod boundary

`TaxPeriod` is shared by input and output tax. Step 9A does not modify shared period transition semantics merely to centralize policy. Existing period administration already restricts access to ADMIN/SUPERADMIN or OWNER/MANAGER with branch enforcement. Input-tax-specific reopen reason, actor evidence, and concurrency controls remain Step 9 follow-up work and must not break Output Tax behavior.

## Evidence

`tests/input-tax-step-9a-capability.contract.test.js` covers allowed roles, denied CASHIER authority, cross-branch rejection, and mandatory actor identity.
