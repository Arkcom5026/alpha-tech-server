# Repair Mobile + Communication migration rollout

## Pre-deploy

1. Take a restorable database snapshot.
2. Run `node scripts/preflight-repair-communication-migration.js`.
3. Run Prisma migration status and confirm every pending migration is approved for the same release.
4. Run the migration contract tests and Prisma schema validation.

Do not use `prisma migrate deploy` to apply only these two migrations when an unrelated migration is pending; deploy applies the entire pending chain.

## Deploy

Run the normal reviewed release migration command. The generic asset migration backfills every existing intake before making `assetDescription` required. Communication profile, preference, customer channel, and manual activity tables are additive.

## Post-deploy

1. Run `node scripts/verify-repair-communication-migration.js`.
2. Run Server communication and repair validator tests.
3. Run the real mobile Browser E2E package and its read-only outcome verifier.

## Recovery

Application rollback is safe while compatibility field `deviceModel` remains. Database rollback must restore the pre-deploy snapshot; do not drop communication tables after new preferences have been written. If only application behavior fails, disable the Communication UI and keep the additive data intact.
