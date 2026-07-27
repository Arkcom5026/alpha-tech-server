# Prisma V4 Foundation Change Log

Status: Device Identity Platform foundation

## Files changed

- `prisma/schema.prisma`
- `docs/architecture/alpha-tech-device-identity-architecture-v1.md`
- `docs/architecture/prisma-v4-foundation-change-log.md`

## Fields added

### Device

- `identityVersion Int @default(1)`
- `registeredAt DateTime @default(now())`
- `retiredAt DateTime?`

### DeviceOwnershipHistory

- `note String?`

### DevicePassportEvent

- `eventVersion Int @default(1)`

## DeviceStatus values added

- `REGISTERED`
- `IN_STOCK`
- `SOLD`
- `RETURNED`

Existing values and the `ACTIVE` default are preserved.

## DevicePassportEventType values added

- `PURCHASE_RECEIVED`
- `SALE_COMPLETED`
- `SALE_RETURNED`
- `REPAIR_RECEIVED`
- `REPAIR_COMPLETED`
- `WARRANTY_CLAIM_OPENED`
- `WARRANTY_CLAIM_RESOLVED`
- `DEVICE_RETIRED`

All existing event values are preserved.

## Indexes added

Device lookup indexes:

- `serialNumber`
- `imei`
- `barcode`
- `(branchId, status)`
- `(currentOwnerCustomerId, status)`

Ownership ledger indexes:

- `(deviceId, ownershipType, endedAt)`
- `(customerId, ownershipType, endedAt)`

Passport ledger indexes:

- `(deviceId, eventType, occurredAt)`
- `(deviceId, customerVisible, occurredAt)`

No serial number, IMEI, or barcode uniqueness constraint was added.

## Non-breaking compatibility notes

- No existing model, field, enum value, index, or relation was removed.
- No existing field or enum value was renamed.
- No optional legacy relation was made required.
- `Device.status` retains `ACTIVE` as its default.
- RepairJob and WarrantyClaim keep their optional Device links with `SetNull`.
- Device ledgers do not use cascade deletion.
- No application code or generated Prisma Client file was changed.

## Migration implications

This change requires a separately reviewed additive database migration before
runtime code can use the new tables, columns, enum values, relations, and indexes.

Existing Device rows, once the Device foundation is migrated, receive defaults for
`identityVersion` and `registeredAt`.

No migration, database push, seed, or destructive database command was executed
as part of this mission.

Legacy backfill and ownership-overlap reconciliation require a dedicated data
plan before production enforcement.

## Deferred items

- normalized brand and model data;
- multiple identifiers;
- device components;
- active DeviceIntake model;
- event sequence, correlation, and causation fields;
- snapshots, projections, and outbox;
- PostgreSQL partial unique index for one active owner.

## Validation results

- `npx prisma format --schema prisma/schema.prisma`: passed
- `npx prisma validate --schema prisma/schema.prisma`: passed
- `git diff --check`: passed
- Schema-specific package verifier: not present
- Prisma Client generation: not run; schema validation was sufficient
- Commit verification: recorded in the mission completion report
