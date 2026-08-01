# Missing Cost Resolution — Prisma Persistence Foundation

Related issue: #222

## Mission
Establish additive Prisma persistence for branch-scoped Missing Cost Resolution without enabling inventory mutation or runtime execution.

## Increment Scope

- Additive enums for resolution status, evidence source type, confidence, and audit event type.
- Branch-scoped resolution aggregate persistence.
- Versioned evidence proposal persistence.
- Append-only lifecycle audit event persistence.
- Deterministic candidate identity, source snapshot hash, evidence hash, and stale-data fields.
- Repository contract for queue/detail/create/update/submit/approve/reject/return/cancel/audit reads.
- Contract and migration tests.

## Required Models

1. `MissingCostResolution`
   - branchId
   - stockBalanceId
   - productId
   - sourceAuditId
   - sourceSnapshotHash
   - candidateIdentityHash
   - status
   - currentVersion
   - recoveryState
   - createdByEmployeeId
   - createdAt / updatedAt

2. `MissingCostResolutionVersion`
   - resolutionId
   - version
   - evidence source type and reference
   - evidence summary
   - proposedUnitCost
   - effectiveDate
   - confidence
   - rationale
   - proposer employee identity
   - evidenceHash
   - immutable approval snapshot fields

3. `MissingCostResolutionEvent`
   - resolutionId
   - versionId optional
   - event type
   - previous/resulting status
   - actor employee identity
   - reason code / note
   - evidence hash
   - occurredAt
   - append-only semantics

## Safety Boundary

- Additive migration only.
- No SimpleLot creation.
- No StockMovement creation or update.
- No StockBalance mutation.
- No recovery execution endpoint.
- No zero-cost default or coercion.
- No cross-branch lookup or uniqueness collapse.
- Approved evidence cannot be silently overwritten.
- Recovery eligibility remains separate from recovery authority.

## Data Isolation

Every resolution aggregate is owned by exactly one `branchId` (store). All repository lookups and writes must require branch scope. Cross-store aggregation is not part of this increment.

## Verification

- `prisma validate` and `prisma generate`.
- Additive migration contract.
- Branch-scoped uniqueness and indexes.
- Version immutability contract.
- Append-only event contract.
- Stale snapshot/evidence guards.
- Existing Recovery and Inventory tests remain green.

## Completion Evidence

- Backend CI PASS.
- Local certification PASS.
- ALDE certification corresponds to the exact certified SHA.
- No runtime inventory mutation is performed by this increment.
