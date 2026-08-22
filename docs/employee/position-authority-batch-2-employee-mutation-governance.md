# Position-first Employee Mutation Governance — Batch 2

## Scope

Batch 2 is stacked on Batch 1 so both batches can be merged, verified and published together at a later combined checkpoint.

This batch migrates the remaining generic employee mutation surface at `/api/employees` while preserving its historical compatibility until each Position is explicitly migrated.

Covered mutations:

- `POST /api/employees`
- `PUT /api/employees/:id`
- `PATCH /api/employees/:id/status`

The existing `employee.manage` capability is reused. No new capability or Prisma migration is required.

## Compatibility semantics

The generic employee routes historically accepted any authenticated account whose platform role was `EMPLOYEE` (plus platform administrators). Tightening that legacy behavior immediately would be a compatibility break, so the transition is asymmetric:

- Position capabilities missing/null => preserve historical generic employee mutation access for legacy employee accounts.
- Position capabilities non-null => Position is authoritative and `employee.manage` is required.
- Position capabilities `[]` => mutation denied; no legacy fallback.
- Platform `ADMIN` / `SUPERADMIN` retain authority.

This compatibility exception is isolated in `employeeManagementAuthorization.js`. It does not change the central `employee.manage` legacy role mapping used by the canonical onboarding flow.

## Boundaries intentionally unchanged

- Employee list/detail reads remain authenticated and branch/domain scoped as before.
- User platform-role mutation and branch dropdowns remain `SUPERADMIN` governance.
- Employee hard delete remains disabled and continues returning the canonical 405 response for authenticated callers.
- The canonical `/api/auth/add-sub-employee` onboarding flow already uses central Position-first `employee.manage` authority and is unchanged.
- The older `onboardEmployeeService.js` role-based implementation is not currently discovered as a mounted runtime route and is not promoted back into runtime authority.
- Position CRUD routes still use platform-admin mutation governance. Migrating Position CRUD would require an explicit delegation design that must not silently broaden historical employee access.

## Verification

Before the combined batch is published, run:

- `employeeManagementAuthorization.test.js`
- existing Position-first authority contracts
- employee lifecycle/runtime verification if present in the repository command set
- full server certification
- Prisma validation

Client verification can remain at the eventual combined checkpoint because this batch introduces no new client capability surface beyond the already-present `employee.manage` option.
