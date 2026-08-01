# Missing Cost Resolution — Runtime Read Foundation

Related issue: #226

## Mission

Connect the certified Missing Cost Resolution domain and Prisma persistence foundation to branch-scoped runtime reads without enabling any resolution mutation or inventory recovery execution.

## Increment Scope

- Prisma-backed queue repository.
- Branch-scoped resolution detail repository.
- Immutable evidence version reads.
- Append-only lifecycle event history reads.
- Deterministic DTO projection using the existing Missing Cost Resolution contracts.
- Read-only service/controller/routes for a future Inventory Recovery Control Center.
- Contract and repository tests.

## Required Read Capabilities

1. Queue
   - Require authenticated/current branch scope.
   - Support deterministic status/product/stock-balance filters.
   - Exclude cross-store records by construction.
   - Preserve candidate and source snapshot hashes for stale-data visibility.

2. Detail
   - Resolve by resolution identity and branchId together.
   - Return a non-leaking not-found result for missing or cross-branch records.
   - Include current status and version authority.

3. Evidence Versions
   - Return versions in deterministic order.
   - Preserve approval snapshots and evidence hashes.
   - Never rewrite or infer cost evidence.

4. Audit History
   - Return append-only events in deterministic chronological order.
   - Preserve actor, previous/resulting status, reason, hashes, and timestamps.

## Safety Boundary

- Read-only increment.
- No create/update/submit/approve/reject/return/cancel endpoints.
- No SimpleLot creation.
- No StockMovement mutation.
- No StockBalance mutation.
- No cost assignment or zero-cost fallback.
- No recovery preview, manifest, approval plan, or execution trigger.
- No cross-branch aggregation.
- No Production database mutation.

## Data Isolation

`Branch` means an independent store/tenant. Every repository query and HTTP response must be scoped exclusively to the authenticated/current `branchId`. Cross-store existence must not be disclosed through distinguishable errors.

## Verification

- Repository contract tests.
- Branch-isolation tests.
- Non-leaking detail behavior.
- Deterministic DTO and ordering tests.
- Existing Missing Cost contracts remain green.
- Existing Recovery and Inventory regressions remain green.
- Prisma multi-file validate/generate.
- Backend CI.
- ALDE certification and exact SHA evidence after merge.

## Completion Authority

This increment is complete only when the Draft PR is reviewed, tests and Backend CI pass, the merged SHA is certified by ALDE SyncAndCertify, and no inventory or Production mutation occurred.
