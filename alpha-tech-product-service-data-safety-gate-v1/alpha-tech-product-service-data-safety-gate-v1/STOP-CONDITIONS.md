# Mandatory Stop Conditions

Stop immediately and do not apply a migration when any condition occurs:

- A backup cannot be verified or restored.
- Prisma reports drift or an unexpected pending migration.
- Any orphan audit returns rows.
- Duplicate keys exist for a proposed unique constraint.
- A backfill cannot be derived from authoritative data.
- Row counts, financial totals, timestamps, events, or completion commands change unexpectedly.
- A migration contains DROP COLUMN, DROP TABLE, destructive type conversion, or CASCADE without a separately approved retirement plan.
- WarrantyClaim rows would be deleted, merged, or reassigned across branches.
- Sale Return or Warranty runtime would mutate another workflow's lifecycle.
