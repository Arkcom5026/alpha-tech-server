# AlphaTech Product Service Data Safety Gate v1

Purpose: protect production data before generating or applying the Product Service / Repair / Warranty migration.

This package does not mutate the database. It captures evidence, audits current rows, and defines stop conditions.

## Authority

- Production data must not be deleted, guessed, overwritten, or disconnected to make a schema change pass.
- Applied migrations are immutable history.
- Use Add -> Backfill -> Verify -> Constrain -> Retire.
- Do not use `prisma migrate reset` or `prisma db push` against production.

## Execution order

1. Run `scripts/01-capture-safety-evidence.ps1` from `D:\alpha-tech\server`.
2. Review generated files under `migration-evidence/product-service-<timestamp>/`.
3. Do not generate the next migration until all audit queries complete successfully.
4. Generate the migration with `--create-only` only after the evidence package is preserved in Git or an external backup location.

This gate intentionally does not approve applying a migration.
