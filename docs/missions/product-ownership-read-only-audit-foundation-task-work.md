# Task Work Mission — Product Ownership Read-Only Audit Foundation

## Mission status

- Repository: `Arkcom5026/alpha-tech-server`
- Working branch: `feature/product-ownership-read-only-audit-foundation`
- Stacked base: `feature/brand-tenant-ownership-additive-foundation`
- Required base SHA: `309762668bef2745c995802642323e7509b94cca`
- Mission type: read-only audit foundation
- Database writes: forbidden
- Backfill: forbidden
- Runtime cutover: forbidden
- Deploy/merge/main update: forbidden

## Critical business-data warning

The system already contains real operational data for **2 active stores**. Each store is an independent tenant. Never merge, reassign, normalize, backfill, or rewrite Product, Brand, price, stock, sale, purchase, repair, reservation, or related records between these stores.

This increment must not connect to Production, Test, shared, or any persistent database containing either store’s data. Build and verify the audit capability with static fixtures or injected repository doubles only.

## Objective

Create a narrowly scoped, deterministic, read-only Product ownership audit foundation that can classify supplied Product evidence without changing any data.

The audit must answer only:

1. Which branch IDs are evidenced for a Product?
2. Is the evidence consistent, ambiguous, orphaned, or template-scoped?
3. Is the Product eligible for a future safe backfill recommendation?

This increment does **not** execute a backfill and does **not** read real store data.

## Required classifications

Use these exact result codes unless an existing repository convention requires a minimal naming adjustment:

- `CONSISTENT`
- `CATALOG_ONLY`
- `OPERATIONAL_ONLY`
- `CROSS_BRANCH_CONFLICT`
- `ORPHAN`
- `TEMPLATE_CONSISTENT`
- `TEMPLATE_LEAKAGE`

The classification engine must be a pure function or equivalently deterministic module. Given the same input evidence, it must return the same result without database, network, clock, environment, or filesystem dependence.

## Evidence contract

The classifier may accept a normalized evidence object containing only branch identifiers and template identity, for example:

```js
{
  productId,
  productBranchId,
  productTypeBranchId,
  branchPriceBranchIds: [],
  stockBalanceBranchIds: [],
  stockItemBranchIds: [],
  stockMovementBranchIds: [],
  simpleLotBranchIds: [],
  transactionBranchIds: [],
  templateBranchId
}
```

Exact internal shape may follow repository conventions, but the contract must clearly separate:

- direct ownership evidence: `Product.branchId`
- catalog evidence: `ProductType.branchId`
- operational evidence: price/stock/lot branch IDs
- transaction-parent evidence
- template branch identity

Do not add Prisma models or migrations in this increment.

## Required classification semantics

### CONSISTENT

All non-null/non-empty evidence points to exactly one non-template branch, and no contradictory branch exists.

### CATALOG_ONLY

Only catalog evidence identifies one non-template branch; no operational or transaction evidence exists.

### OPERATIONAL_ONLY

Catalog/direct Product ownership evidence is absent, while operational evidence identifies exactly one non-template branch with no conflict.

### CROSS_BRANCH_CONFLICT

Evidence points to more than one distinct non-template branch, or `Product.branchId` conflicts with another evidence source.

### ORPHAN

No usable branch evidence exists.

### TEMPLATE_CONSISTENT

All usable evidence points only to the template branch.

### TEMPLATE_LEAKAGE

Template and non-template branch evidence coexist, or a template-owned Product has operational/transaction evidence belonging to a real store.

## Recommendation contract

The result must include a machine-readable recommendation field with only:

- `SAFE_BACKFILL_CANDIDATE`
- `MANUAL_REVIEW_REQUIRED`
- `NO_BACKFILL_EVIDENCE`
- `TEMPLATE_REVIEW_REQUIRED`

Rules:

- `CONSISTENT`, `CATALOG_ONLY`, and `OPERATIONAL_ONLY` may recommend `SAFE_BACKFILL_CANDIDATE` only when exactly one branch is evidenced.
- `CROSS_BRANCH_CONFLICT` must recommend `MANUAL_REVIEW_REQUIRED`.
- `ORPHAN` must recommend `NO_BACKFILL_EVIDENCE`.
- Template classifications must recommend `TEMPLATE_REVIEW_REQUIRED` unless the repository contract clearly establishes another non-mutating recommendation.

The word “safe” means safe as an audit recommendation only. This increment must not write `Product.branchId`.

## Exact allowed scope

Allowed:

1. One pure Product ownership audit/classification module in the existing architecture location discovered by Task Work.
2. Narrowly targeted unit/contract tests using fixtures only.
3. Minimal exports/index registration required solely to import the pure module in tests.
4. This Mission Pack reconciliation if needed.

Forbidden:

- Prisma schema or migration changes
- Database repository implementation
- Prisma Client queries
- API, controller, route, UI, CLI command, scheduled job, startup hook, seed, bootstrap, or deploy integration
- Product/Brand runtime changes
- ProductTemplate/Candidate/Promotion/Media changes
- Backfill scripts
- Writing audit results to a table or file used by runtime
- Reading environment database credentials
- Connecting to any database

If the module cannot be implemented without broad runtime integration, stop and report `BLOCKED`.

## Required tests

Tests must cover at minimum:

1. one-branch consistent evidence
2. catalog-only evidence
3. operational-only evidence
4. cross-branch conflict between ProductType and BranchPrice
5. conflict between `Product.branchId` and stock evidence
6. orphan Product
7. template-consistent evidence
8. template leakage into a real store
9. duplicate branch IDs do not create a false conflict
10. null/empty evidence is handled deterministically
11. input is not mutated
12. no database/network dependency is imported or invoked

## Verification

Run only repository-safe static/unit verification. At minimum:

```bash
node <targeted-product-ownership-audit-test>
git diff --check
```

Also run the narrow existing module test command if required by repository convention and if it does not connect to a database.

Do not run application startup, Prisma migrations, database bootstrap, seed, E2E, or tests that may access persistent data.

## Acceptance criteria

PASS only when all are true:

1. The classifier is pure and deterministic.
2. All seven classifications are implemented and tested.
3. Recommendations are machine-readable and tested.
4. No Prisma schema/migration changed.
5. No database adapter/query/runtime endpoint was added.
6. No real/shared database was contacted.
7. Neither active store’s data was read or changed.
8. No Product/Brand backfill or ownership mutation exists.
9. Targeted tests and `git diff --check` pass.
10. Changes remain only on the feature branch and PR remains Draft.

Any deviation is `FAIL` or `BLOCKED`, never partial PASS.

## Final report format

```text
Task Work Result: PASS | FAIL | BLOCKED
Branch:
Stacked Base SHA:
Final SHA:

Files Changed:
- ...

Audit Contract:
- classifications implemented:
- recommendation codes implemented:
- pure/deterministic: yes/no
- input mutation: yes/no
- DB/network imports: yes/no

Verification:
- targeted test command/result:
- additional safe tests:
- git diff --check:

Business Data Safety:
- active real stores known: 2
- database contacted: yes/no
- real tenant data read: yes/no
- Product/Brand rows changed: yes/no
- backfill performed: yes/no

Scope Compliance:
- Prisma changed: yes/no
- runtime/API/FE changed: yes/no
- ProductTemplate/Candidate/Media changed: yes/no
- deployed/merged/main updated: yes/no

Notes / blockers:
- ...
```
