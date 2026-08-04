# Store Device Persistence Foundation — Task Work Mission

## Authority

- Repository: `Arkcom5026/alpha-tech-server`
- Branch: `feature/store-device-persistence-foundation`
- Base SHA: `505fcdde92abc471b768435a91b8acb6e618c08a`
- Client runtime authority: `Arkcom5026/alpha-tech-client` PR #104
- Epic authority: Alpha-Tech Store Device & Printing Platform

## Mission

Create the additive server-side persistence foundation for branch-isolated Store Device Gateway, authenticated sessions, device jobs, leases, and immutable results. This increment establishes durable authority only. It must not enable Production WebSocket transport, physical printing, remote device execution, or automatic migration deployment.

## Required Prisma Models

### `StoreDeviceGateway`

Required semantics:

- Immutable public `gatewayId`
- Required `branchId`
- Enrollment state and runtime state
- Credential version metadata only; never store plaintext proof key
- Capabilities and platform snapshot as JSON
- Last heartbeat, last authenticated, revoked timestamps
- Created/updated timestamps
- Unique `(branchId, gatewayId)`
- Reverse relation from `Branch`

### `StoreDeviceGatewaySession`

Required semantics:

- Required `branchId` and gateway relation
- Immutable public `sessionId`
- Credential version used by the session
- Challenge ID and authentication state
- Reconnect cursor
- Connected, authenticated, disconnected, revoked, expiry timestamps
- Unique `(branchId, sessionId)`
- Index by gateway and active lifecycle state

### `StoreDeviceJob`

Required semantics:

- Required `branchId`
- Immutable public `jobId`
- Required `idempotencyKey`
- Job type, source, status, target device/profile
- Immutable request snapshot JSON
- Correlation/causation metadata
- Requested, completed, failed, cancelled timestamps
- Unique `(branchId, jobId)`
- Unique `(branchId, idempotencyKey)`
- No cross-store global uniqueness that could collapse unrelated stores

### `StoreDeviceJobLease`

Required semantics:

- Required `branchId`, job, gateway, and session relations
- Immutable public `leaseId`
- Lease state and attempt number
- Lease start, expiry, acknowledgement, completion, failure timestamps
- Only one active lease authority per job must be enforced by service policy and, where safely representable, database constraints
- Unique `(branchId, leaseId)`
- Unique `(jobId, attemptNumber)`

### `StoreDeviceJobResult`

Required semantics:

- Required `branchId`, job, lease, gateway, and session relations
- Immutable public `resultId`
- Terminal result state
- Adapter/transport evidence
- Result snapshot and error metadata as JSON
- Executed and recorded timestamps
- Append-only audit semantics
- Unique `(branchId, resultId)`
- Unique lease result when contract permits exactly one terminal result

## Required Enums

Define explicit enums for:

- Gateway enrollment state
- Gateway runtime state
- Gateway session state
- Device job type
- Device job status
- Device job lease status
- Device job result status

Names must be descriptive, stable, and independent of one printer vendor or one transport.

## Tenant Isolation Invariants

1. `Branch` means independent store/tenant.
2. Every model must carry required `branchId`.
3. Every repository read/write must require authenticated/current branch authority.
4. A gateway registered to one branch cannot access another branch's sessions, jobs, leases, or results.
5. A job cannot be leased to a gateway/session from another branch.
6. Foreign-key relations alone are insufficient; service/repository contracts must verify branch equality across all linked records.
7. Cross-store aggregation is out of scope.

## Idempotency and Recovery Invariants

- Repeated creation with the same `(branchId, idempotencyKey)` must resolve to the same job authority.
- Reconnect must not create duplicate active leases.
- Terminal results are immutable and auditable.
- A revoked gateway/session cannot obtain a new lease.
- Expired leases may be superseded only through an explicit new attempt.
- No job may silently disappear after process restart.

## Prisma and Migration Scope

Allowed:

- Additive enums, models, relations, indexes, and one additive migration.
- Add reverse relations to `Branch` only where required.
- Add contract tests for schema shape, branch isolation, idempotency, lease authority, and append-only results.

Forbidden:

- Removing or renaming existing models/fields.
- Reusing unrelated legacy printer tables without proven semantic compatibility.
- Backfilling Production data.
- Applying migration to any database in this PR.
- Introducing plaintext credentials, proof keys, tokens, or certificates.
- Enabling WebSocket endpoint, physical printing, RAW execution, or device control.
- Merge or deploy without separate authority.

## Required Verification

Run on the exact implementation SHA:

```powershell
npx prisma format
npx prisma validate
npx prisma generate
node tests/store-device-persistence-foundation.contract.test.js
```

Also inspect generated migration SQL and report:

- Created enums/tables/indexes/foreign keys
- Destructive statements: must be none
- Cross-branch uniqueness mistakes: must be none
- Plaintext credential fields: must be none

## Migration and Recovery Gate

Before any future database apply, lock:

- Repository
- Branch
- Exact commit SHA
- Migration directory/name
- Prisma schema
- Database target

Then satisfy the Unified Database Migration & Recovery Authority Standard, including backup/snapshot and restore authority. This mission authorizes code creation and verification only; it does not authorize migration apply.

## Acceptance Evidence

Task Work must return:

- Exact HEAD SHA
- Changed files
- Prisma validation/generation output
- Contract-test output
- Migration SQL review
- Confirmation that no database was modified
- Confirmation that no Production transport or physical execution was enabled
