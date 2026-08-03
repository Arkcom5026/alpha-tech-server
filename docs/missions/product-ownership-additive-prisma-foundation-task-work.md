# Task Work Mission — Product Ownership Additive Prisma Foundation

## Mission Status

- Mission type: Prisma additive foundation only
- Repository: `Arkcom5026/alpha-tech-server`
- Working branch: `feature/product-ownership-additive-foundation`
- Base branch: `main`
- Current base SHA authority: `5007518c4bfeaebc3d66ceafaac2537c3495b7f4`
- Runtime behavior change: **forbidden**
- Data backfill: **forbidden**
- Production deployment: **forbidden**
- Database mutation against any shared/real database: **forbidden**

## Critical Business-Data Warning

This repository and its connected databases already contain real operational business data for **2 active stores**.

Treat all existing Product, ProductType, BranchPrice, StockBalance, StockItem, StockMovement, Sale, Purchase, Repair, Reservation, and related records as business-critical data.

The two stores are independent tenants. Never infer that they are branches of one shared business. Never combine, reassign, merge, normalize, backfill, or rewrite their data in this mission.

A mistake in Product ownership can cause cross-store product, price, stock, sales, purchase, or repair leakage. Therefore this mission is intentionally additive and nullable only.

## Objective

Add an explicit nullable Product ownership field to Prisma as a future canonical Branch ownership foundation, without changing current runtime behavior or existing data.

The only intended domain change is:

```prisma
Product.branchId Int?
Product.branch   Branch?
Branch.products  Product[]
```

This increment establishes schema capability only. It does not establish runtime cutover, ownership backfill, or enforcement.

## Exact Allowed Scope

Only the following files may be changed:

1. `prisma/schema.prisma`
2. One new additive migration directory under `prisma/migrations/`
3. A narrowly targeted schema/migration contract test only if the repository already has an established convention for Prisma foundation contract tests

Do not change any Backend runtime, Frontend, service, controller, repository, route, policy, mapper, seed, bootstrap, deploy, CI, or documentation file beyond this mission file unless a verification artifact is required by an existing repository standard.

## Required Prisma Change

### Branch model

Add a reverse relation with a clear, non-conflicting field name:

```prisma
products Product[]
```

Before editing, confirm that `Branch` does not already have a Product relation under another field name. Do not rename any existing Branch relation.

### Product model

Add:

```prisma
branchId Int?
branch   Branch? @relation(fields: [branchId], references: [id], onDelete: Restrict)
```

Use the repository's existing formatting conventions.

Add only these indexes unless Prisma or an existing naming collision requires a minimal adjustment:

```prisma
@@index([branchId])
@@index([branchId, active])
@@index([branchId, productTypeId])
@@index([branchId, templateProductId])
```

Do not add a unique constraint.
Do not make `branchId` required.
Do not add a default value.
Do not derive Branch ownership from ProductType or BranchPrice in schema code.
Do not modify `templateProductId`.

## Required Migration Semantics

Create one additive migration with SQL equivalent to:

```sql
ALTER TABLE "Product"
ADD COLUMN "branchId" INTEGER;

ALTER TABLE "Product"
ADD CONSTRAINT "Product_branchId_fkey"
FOREIGN KEY ("branchId")
REFERENCES "Branch"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "Product_branchId_idx"
ON "Product"("branchId");

CREATE INDEX "Product_branchId_active_idx"
ON "Product"("branchId", "active");

CREATE INDEX "Product_branchId_productTypeId_idx"
ON "Product"("branchId", "productTypeId");

CREATE INDEX "Product_branchId_templateProductId_idx"
ON "Product"("branchId", "templateProductId");
```

Use Prisma-generated naming when possible. If Prisma generates a materially different but semantically equivalent migration, report the difference explicitly.

The migration must contain no `UPDATE`, `DELETE`, `INSERT`, data-copy, backfill, branch inference, trigger, function, or destructive DDL.

## Absolute Prohibitions

Do not perform any of the following:

- Do not modify Brand or add `Brand.branchId`
- Do not create Candidate, Promotion, Review, Event, or Audit models
- Do not modify ProductTemplate runtime
- Do not modify Template clone/adoption
- Do not modify Product create/update/query runtime
- Do not modify ProductType ownership
- Do not modify BranchPrice, Stock, Sales, Purchase, Repair, Reservation, Tax, Marketplace, or Barcode models
- Do not copy or reassign existing Product rows
- Do not set `Product.branchId` for any existing record
- Do not infer ownership from `ProductType.branchId`, `BranchPrice.branchId`, stock records, or transactions
- Do not remove or alter existing indexes or constraints
- Do not make Product ownership required
- Do not run `prisma migrate deploy` against Production, Test DB, shared DB, or any database containing the two stores' real business data
- Do not deploy to Render, Vercel, or any runtime environment
- Do not merge the branch
- Do not push changes to `main`
- Do not broaden scope because another architectural issue is discovered

If an unrelated schema problem blocks validation, stop and report it. Do not repair unrelated schema or migrations in this mission.

## Database Safety Rules

This mission must be completed without mutating any database containing real or shared data.

Allowed verification:

- `npx prisma format`
- `npx prisma validate`
- `npx prisma generate`
- Static inspection of migration SQL
- Contract tests that do not connect to or mutate a real/shared database
- A disposable isolated database created specifically for this mission, only if the environment clearly proves it is disposable and contains no store data

Forbidden verification:

- `prisma migrate deploy` on any existing environment
- `prisma migrate dev` against any shared or persistent database
- Reset, drop, truncate, shadow against a database that may contain business data
- Any script that backfills or updates existing Product records

Before any database command beyond validate/generate, Task Work must prove the database is disposable. If that proof is unavailable, skip database execution and report it as not run.

## Required Execution Procedure

1. Confirm the checkout is `feature/product-ownership-additive-foundation`.
2. Confirm the branch starts from or is compatible with base SHA `5007518c4bfeaebc3d66ceafaac2537c3495b7f4`.
3. Confirm the working tree is clean before changes.
4. Read the complete current `prisma/schema.prisma`; do not work from a truncated excerpt.
5. Check for existing Product↔Branch relation names and migration naming collisions.
6. Apply only the allowed Prisma relation and indexes.
7. Run `npx prisma format`.
8. Generate one additive migration without applying it to a shared database. Preferred method is schema diff or a disposable isolated database.
9. Inspect the complete migration SQL and prove it contains no data mutation or destructive statement.
10. Run `npx prisma validate`.
11. Run `npx prisma generate`.
12. Run narrowly relevant contract tests if they exist and do not mutate shared data.
13. Inspect `git diff -- prisma/schema.prisma prisma/migrations` and confirm no unrelated changes.
14. Commit the finished increment to the feature branch only.
15. Do not merge, deploy, or trigger production migration.

## Stop Conditions

Stop immediately and report without improvising if:

- The full schema cannot be read safely
- A Product↔Branch relation already exists with different semantics
- The migration tool requires connecting to a database that might contain either store's real data
- Prisma proposes dropping, rewriting, renaming, or rebuilding an existing table/column/index
- Validation fails because of an unrelated pre-existing problem
- More than the allowed files need modification
- Any existing Product data would need backfill for the migration to succeed
- The branch is not based on the expected main state

## Required Verification Evidence

Return exact evidence for:

- Branch name and starting SHA
- Files changed
- Exact Product and Branch schema diff
- Migration directory name
- Complete migration SQL summary
- Confirmation: no data statements and no destructive DDL
- `npx prisma format` result
- `npx prisma validate` result
- `npx prisma generate` result
- Contract-test commands and results, if run
- Final commit SHA
- `git diff --stat main...HEAD`
- Explicit confirmation that no database containing the 2 stores' real business data was modified
- Explicit confirmation that no backfill, runtime change, deploy, merge, or main update occurred

## Acceptance Criteria

PASS only when all are true:

1. `Product.branchId` is nullable.
2. `Product.branch` points to `Branch` with `onDelete: Restrict`.
3. `Branch.products` reverse relation exists.
4. The four agreed indexes exist.
5. Exactly one additive migration implements only this foundation.
6. Existing rows require no update and remain valid with `branchId = NULL`.
7. Prisma validate and generate pass.
8. No runtime file changed.
9. No Brand/Candidate/Promotion/Media work was included.
10. No real/shared database was mutated.
11. No data from either of the 2 active stores was changed.
12. Work remains only on `feature/product-ownership-additive-foundation`.

Any deviation is FAIL or BLOCKED, not partial PASS.

## Final Report Format

```text
Task Work Result: PASS | FAIL | BLOCKED
Branch:
Base SHA:
Final SHA:

Files Changed:
- ...

Schema Change:
- ...

Migration:
- directory:
- additive only: yes/no
- data mutation present: yes/no
- destructive DDL present: yes/no

Verification:
- prisma format:
- prisma validate:
- prisma generate:
- targeted tests:

Business Data Safety:
- real stores known: 2
- shared/real DB modified: yes/no
- Product rows backfilled: yes/no
- other tenant data modified: yes/no

Scope Compliance:
- runtime changed: yes/no
- Brand changed: yes/no
- Candidate/Promotion changed: yes/no
- deployed: yes/no
- merged/main updated: yes/no

Notes / blockers:
- ...
```
