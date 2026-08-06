# Store Experience Published Snapshot Backfill

## Problem

Storefronts published before the published-snapshot columns were introduced can remain in an inconsistent legacy state:

- `status = PUBLISHED`
- `publishedAt` is populated
- draft theme/layout/sections exist
- `publishedVersion` and all published snapshot fields are `NULL`

The public storefront correctly requires `publishedVersion IS NOT NULL`, so those legacy storefronts become unavailable after adopting published-only projection.

## Authority

This increment preserves the published-snapshot architecture. It does not add a public fallback to mutable draft fields.

## Change

Add one guarded data migration that copies the existing published-era draft values into snapshot columns only when:

- the profile is already `PUBLISHED`; and
- `publishedVersion IS NULL`.

Existing snapshots are never overwritten.

## Safety Contract

- No `DROP`, `DELETE`, or `TRUNCATE`.
- No update to `DRAFT`, `READY`, or `SUSPENDED` profiles.
- No update to rows that already have a published snapshot.
- `publishedAt` is preserved.
- `version` is copied to `publishedVersion` without changing draft version history.

## Verification

```bash
node tests/store-experience-published-snapshot-backfill.contract.test.js
node tests/store-experience-published-snapshot-foundation.contract.test.js
node tests/public-storefront-product-discovery.contract.test.js
npx prisma validate
```

Database execution remains a separate approval step under the migration and recovery workflow.
