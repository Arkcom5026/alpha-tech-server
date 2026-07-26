# Slice 3 — Prisma Tax Foundation Local Handoff

## Status

Repository design: COMPLETE
Local Prisma execution: REQUIRED
Database migration: NOT YET VERIFIED
Runtime integration: NOT ENABLED
Legacy behavior impact before Local migration: NONE

## Purpose

Introduce the additive database foundation for the Tax capability without deleting, renaming, or repurposing any existing Sales, Procurement, Repair, Expense, report, filing, Branch, Customer, Supplier, or Employee field.

## Candidate source

Append the complete contents of:

```text
docs/tax/prisma/tax-foundation.additive.prisma
```

to:

```text
prisma/schema.prisma
```

Do not modify the candidate block unless Prisma validation reports a concrete schema error. If an adjustment is needed, preserve the domain names and invariants and include the exact validation evidence in the commit.

## Why this is additive

The candidate:

- adds new Tax-owned enums and models only;
- does not remove or rename existing schema elements;
- does not add required fields to existing rows;
- does not add foreign-key relations back into `Sale`, `SaleReturn`, `PurchaseOrderReceipt`, `RepairJob`, `Branch`, or `EmployeeProfile`;
- uses `sourceType + sourceId` as the transition-safe source identity;
- keeps all mandatory relations inside the new Tax domain;
- permits legacy reports and print flows to continue unchanged.

## Models introduced

```text
TaxCandidate
TaxDocument
TaxDocumentPartySnapshot
TaxDocumentItemSnapshot
TaxNumberSequence
TaxPeriod
TaxLedgerEntry
```

## Core invariants

1. A source may create at most one candidate for the same tax direction.
2. A candidate may convert to at most one TaxDocument.
3. TaxDocument source identity is preserved independently of live business data.
4. Issuer and recipient information is stored as immutable party snapshots.
5. Tax document items are immutable line snapshots, not live Product projections.
6. Official numbering is branch, document type, and year scoped.
7. Ledger registration is idempotent through `registrationKey`.
8. Tax periods are unique by branch, year, and month.
9. Corrections and reversals create linked records; they do not overwrite original ledger evidence.
10. Existing filing batches remain operational until a later compatibility/cutover slice.

## Local commands

Run from the backend repository root on branch:

```text
feature/tax-platform-authority
```

### 1. Confirm clean authority state

```powershell
git branch --show-current
git status --short
git pull --ff-only origin feature/tax-platform-authority
```

Expected branch:

```text
feature/tax-platform-authority
```

### 2. Back up the current schema

```powershell
Copy-Item prisma/schema.prisma prisma/schema.before-tax-foundation.prisma
```

The backup is for Local recovery only. Do not commit it.

### 3. Append the candidate block

Copy all contents from:

```text
docs/tax/prisma/tax-foundation.additive.prisma
```

and append them to the end of:

```text
prisma/schema.prisma
```

### 4. Format and validate

```powershell
npx prisma format
npx prisma validate
npx prisma generate
```

All three commands must pass before creating a migration.

### 5. Inspect the migration before applying

Preferred development command:

```powershell
npx prisma migrate dev --name add_tax_platform_foundation --create-only
```

Inspect the generated SQL. It must contain only additive operations for the new enums, tables, indexes, unique constraints, and Tax-internal foreign keys.

It must not contain:

- `DROP TABLE`
- `DROP COLUMN`
- renames of existing tables or columns
- destructive alteration of existing Sales or Procurement data
- required-column additions to existing populated tables

### 6. Apply the migration

After inspection:

```powershell
npx prisma migrate dev
```

Then rerun:

```powershell
npx prisma validate
npx prisma generate
```

### 7. Verify database objects

At minimum, verify that these tables exist:

```text
TaxCandidate
TaxDocument
TaxDocumentPartySnapshot
TaxDocumentItemSnapshot
TaxNumberSequence
TaxPeriod
TaxLedgerEntry
```

Also verify that existing application tables and data remain present.

### 8. Commit and push

Commit only the intended schema and migration files:

```powershell
git add prisma/schema.prisma prisma/migrations docs/tax

git diff --cached --check
git diff --cached --stat

git commit -m "feat(tax): add Prisma tax platform foundation"
git push origin feature/tax-platform-authority
```

## Evidence to return

Please return the console output or screenshot evidence for:

```text
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name add_tax_platform_foundation --create-only
migration SQL inspection
npx prisma migrate dev
git diff --check
git commit SHA
git push verification
```

## Stop conditions

Stop and do not apply the migration if:

- Prisma reports a model or relation conflict;
- generated SQL contains destructive changes;
- migration attempts to modify unrelated existing tables;
- the local schema differs materially from the branch schema;
- the database reports drift requiring reset or data loss.

Do not use `prisma migrate reset` for this task.

## Gate policy

Repository Gate can pass when the candidate and handoff are present and internally consistent.

Runtime Gate remains pending until Local `format`, `validate`, `generate`, and migration execution pass.

Operational Gate remains pending until later Tax services write and read the new models without affecting existing workflows.
