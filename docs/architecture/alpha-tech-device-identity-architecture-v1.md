# Alpha-Tech Device Identity Architecture v1

Status: Prisma V4 foundation

## Purpose

This architecture establishes a durable identity and cross-workflow history for
physical devices handled by Alpha-Tech.

It is an incremental foundation. It does not replace existing Sale, Repair,
Warranty Claim, stock, or customer workflows.

Core rule:

> Operational modules own their workflow state. Device owns durable identity and cross-workflow history.

The design is not full Event Sourcing.

## Aggregate authority

`Device` is the aggregate root for physical-device identity.

It provides the stable reference shared by stock, sale, repair, warranty, and
future intake workflows.

Workflow models remain authoritative for their own state machines:

- Sale owns sale completion and return behavior.
- RepairJob owns repair workflow state.
- WarrantyClaim owns claim workflow state and resolution.
- Stock and procurement models own inventory and receipt state.

No operational module should create a competing cross-workflow device history.

## Device identity policy

`Device.fingerprint` is the immutable runtime-generated identity.

It is not a serial number, IMEI, barcode, display identifier, or concatenated
business key.

Serial number, IMEI, and barcode are searchable attributes. They are not globally
unique in this foundation because real-world data may be absent, duplicated, or
corrected.

`identityVersion` identifies the fingerprint policy version. It is not an
aggregate version or optimistic-lock counter.

`registeredAt` records when the identity entered the platform.

`retiredAt` records permanent retirement only. Temporary repair, return, claim,
or stock transitions must not populate it.

`Device.status` is a read-optimized lifecycle projection.

Authoritative workflow state remains in the originating workflow model.

Where supported, a lifecycle-changing workflow must update `Device.status` and
append the corresponding `DevicePassportEvent` in one application transaction.

## Ownership Ledger policy

`DeviceOwnershipHistory` is the Ownership Ledger and historical Source of Truth.

Rows describe ownership periods and should remain append-oriented.

Closing an ownership period sets `endedAt`; historical rows must not be repurposed
or deleted to represent a later owner.

`Device.currentOwnerCustomerId` is only a read projection of the active ownership
state.

Ownership mutations must update the ledger and current-owner projection
atomically where supported.

Application policy must reject overlapping active ownership periods.

A nullable `endedAt` composite unique constraint does not enforce one active
owner correctly in PostgreSQL.

A future partial unique index may be introduced only through a reviewed SQL
migration after runtime ownership mutations and legacy data are verified.

## Passport Ledger policy

`DevicePassportEvent` is the append-oriented Operational Ledger.

Modules publish facts during or after authoritative workflow transitions.

Passport events support a cross-workflow device timeline but do not replace
workflow-specific state machines.

Historical events must not be rewritten to represent current state.

`eventVersion` is the schema version of event metadata or payload interpretation.

It is not an event sequence and is not an optimistic-lock version.

Customer visibility is an explicit event projection controlled by
`customerVisible`.

## Workflow ownership versus device-history ownership

A Sale completion remains authoritative in Sale while publishing a
`SALE_COMPLETED` device fact when a Device is linked.

A Sale return remains authoritative in the return workflow while publishing a
`SALE_RETURNED` fact and updating lifecycle projection when appropriate.

A RepairJob remains authoritative for repair status while publishing repair
receipt, update, and completion facts.

A WarrantyClaim remains authoritative for claim state and resolution while
publishing claim-opened, updated, and resolved facts.

Procurement and stock workflows remain authoritative for receiving and inventory
state while publishing device receipt or stock lifecycle facts.

## Transactional consistency expectations

Runtime commands should write authoritative workflow state first or within the
same transaction as Device projections and passport facts.

When one Prisma transaction can own all writes, it should atomically:

1. mutate the workflow state;
2. update affected Device lifecycle or owner projections;
3. append ownership or passport ledger facts.

Retries must not create unintended duplicate facts. Runtime implementation should
define command-level idempotency before publishing events broadly.

No database triggers are part of this foundation.

## Referential-integrity policy

Device ledger history must not cascade-delete with Device, Customer, Employee, or
Branch removal.

Required historical references use restrictive deletion behavior.

Optional actor projections may use `SetNull` so the historical fact remains when
an employee or customer actor is removed.

Optional RepairJob and WarrantyClaim links to Device may use `SetNull` for legacy
compatibility.

No existing optional legacy relation becomes required in this increment.

## Explicitly deferred V5 items

- normalized DeviceBrand and DeviceModel models;
- multiple identifier records and identifier verification;
- device components and component history;
- DeviceIntake model and active intake relation;
- event sequencing;
- correlation and causation identifiers;
- snapshots and projection tables;
- outbox infrastructure;
- partial unique index for one active owner;
- rental, trade-in, maintenance, inspection, IoT, GPS, sensor, firmware, and
  telemetry domains.

## Runtime implementation obligations

Runtime work following this schema foundation must:

- generate immutable fingerprints under a documented identity policy;
- create or resolve Device without changing existing API contracts;
- keep ownership ledger and current-owner projection consistent;
- prevent overlapping active ownership periods;
- append passport events without rewriting historical facts;
- update lifecycle projection with authoritative workflow transitions;
- perform related writes in one application transaction where supported;
- define idempotency behavior for retries;
- backfill legacy data through a separately reviewed migration plan;
- add database constraints only after legacy data and runtime behavior are proven.
