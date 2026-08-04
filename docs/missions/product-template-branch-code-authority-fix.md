# Product Template Branch-Code Authority Fix

## Runtime evidence

Candidate discovery returned `TEMPLATE_BRANCH_NOT_FOUND` for `businessType=IT` even though the canonical Product Template catalog exists under Template Branch `T01`.

## Root cause

The discovery resolver queried `Branch.businessType = IT`. The existing Product Template runtime does not use that field as Template authority; it resolves the canonical Template Branch by `branchCode`, defaulting to `T01`.

## Correct authority

`businessType=IT` -> `templateBranchCode=T01` -> resolved Template Branch -> `categoryId` -> real Store Branches in the same category.

## Safety

- Read-only resolver change.
- No migration.
- No Product, Candidate, Template, stock, price, or transaction mutation.
- Dry-run materialization remains non-mutating.

## Verification

`node tests/product-template-branch-code-authority-fix.contract.test.js`
