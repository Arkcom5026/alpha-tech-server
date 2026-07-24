# Safe Migration Phases

## Phase A — Evidence only

Capture backup identity, migration status, schema checksum, row counts, orphan audits, duplicate audits, and legacy links. No schema mutation.

## Phase B — Additive foundation

Create new Repair/Product Service structures and add new foreign keys as nullable. Preserve all existing WarrantyClaim columns and rows, including `saleReturnItemId`. Do not add NOT NULL constraints in this phase.

## Phase C — Conservative backfill

Backfill only where the relationship is provable from existing authoritative data. Ambiguous rows go to an exception report; they are never guessed or deleted.

## Phase D — Verification

Compare before/after counts, financial totals, timestamps, event rows, completion commands, stock references, branch ownership, and legacy-link evidence.

## Phase E — Runtime cutover

New writes use RepairJob-owned WarrantyClaim flow. Legacy `saleReturnItemId` becomes read-only evidence. Sale Return may reference a closed RepairJob but cannot mutate Repair lifecycle.

## Phase F — Constraint hardening

Only after all live claims have valid RepairJob links and runtime cutover is proven may nullable fields become required.

## Phase G — Retirement

A legacy column may be dropped only in a separate migration after code-search, report/export verification, backup restore test, and evidence equivalence all pass.
