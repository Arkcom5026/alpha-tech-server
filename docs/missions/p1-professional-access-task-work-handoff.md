# P1 Professional Access — Task Work Runtime Integration Mission

## Runtime Authority

Source branch:

```text
agent/p1-backend-repository-completion
```

Stacked authority:

```text
PR #103 → #104 → #105 → #106 → #108 → #110 → #113 → #114 → #117 → #120 → final completion PR
```

## Mission

Integrate and certify the complete P1 Professional Access backend without redesigning its contracts or authority rules.

## Required Prisma Work

1. Merge `prisma/fragments/professional-access-foundation.prisma` into canonical `prisma/schema.prisma`.
2. Merge `prisma/fragments/tax-review-collaboration.prisma` into canonical `prisma/schema.prisma`.
3. Add all documented reverse relation fields to existing `User` and `Branch` models.
4. Keep `Branch.businessId` nullable for compatibility.
5. Do not remove or alter `EmployeeProfile.branchId` or current `req.user.branchId` projection.
6. Run `prisma format`, `prisma validate`, and `prisma generate`.
7. Apply the additive migrations in dependency order.

## Required Repository Verification

Run:

```bash
node scripts/verify-current-tenant-isolation-audit.js
node scripts/verify-business-ownership-contract.js
node scripts/verify-external-organization-foundation.js
node scripts/verify-business-accounting-firm-assignment.js
node scripts/verify-permission-scope-contract.js
node scripts/verify-professional-access-prisma-foundation.js
node scripts/verify-accountant-review-workspace.js
node scripts/verify-tax-review-collaboration.js
node scripts/verify-professional-access-runtime-integration.js
node scripts/verify-shared-professional-access-authority.js
node scripts/verify-professional-access-backend-completion.js
```

## Required Runtime Verification

Verify server startup and all routes under:

```text
/api/professional-access
```

Test at minimum:

- unauthenticated request is denied;
- inactive organization membership is denied;
- inactive, future, and expired assignments are denied;
- assignment without matching permission is denied;
- selected-branch scope cannot access another branch;
- list assigned businesses returns only active assignments;
- business workspace projects only active scopes and owned branches;
- tax review can be created for an authorized branch;
- tax review note can be added for an authorized branch;
- resolved review rejects new notes;
- repeated resolve is idempotent;
- review note and resolve load persisted `review.branchId` before permission evaluation.

## Operational Evidence Required

Return:

- source branch and exact SHA;
- Prisma format/validate/generate output;
- migration execution output;
- verifier command outputs;
- server startup output;
- HTTP request/response evidence for allow and deny cases;
- database rows for Business, Assignment, Permission Scope, Tax Review Session, and Tax Review Note;
- confirmation that existing Branch-based employee runtime still works;
- final PASS/FAIL separated into Repository, Runtime, and Operational gates.

## Prohibited Changes

- no frontend work;
- no replacement of current employee branch authority;
- no destructive migration;
- no widening of permission scopes;
- no trusting client-supplied organization, business, assignment, or branch identifiers as authority;
- no automatic accounting-firm self-assignment;
- no production deployment without explicit owner approval.
