# Missing Cost Resolution — Recovery Integration

Related issue: #230

## Mission

Connect approved Missing Cost Resolution evidence to the existing controlled inventory recovery architecture without bypassing branch isolation, stale-data authority, explicit approval, deterministic planning, idempotent execution, or post-recovery audit.

## Current Authority

The repository already contains:

- Branch-scoped Missing Cost Resolution runtime reads.
- Optimistic mutation workflow with immutable evidence versions and lifecycle events.
- Separate-approver policy for approval.
- Existing recovery patterns with validated dry-run authority, deterministic execution-plan hashes, explicit approval inputs, stale-data aborts, and controlled execution.

This mission integrates those authorities. It must not invent a parallel recovery model or bypass existing inventory contracts.

## E2E Flow

1. Load an `APPROVED` resolution by `resolutionId + branchId`.
2. Resolve the exact approved evidence version and evidence hash.
3. Re-read the current branch-scoped inventory source.
4. Build a fresh recovery preview and stale-data assessment.
5. Abort on stale status, version, snapshot, evidence, product, stock balance, or branch authority.
6. Build a deterministic plan bound to the approved resolution and operator identity.
7. Require explicit approval inputs matching the exact plan authority.
8. Execute once in a controlled transaction.
9. Preserve append-only execution evidence and project the resulting inventory authority.

## Increments

### Increment 1 — Approved Resolution Recovery Preview

Read-only integration only.

Required capabilities:

- Load only `APPROVED` resolutions scoped by current `branchId`.
- Resolve the exact approved evidence version.
- Re-read the current stock balance/product authority.
- Project deterministic preview authority and stale reasons.
- Return a non-leaking not-found result for missing or cross-branch records.
- Perform no inventory mutation.

### Increment 2 — Deterministic Approval Plan

Plan-only integration.

Required capabilities:

- Build stable `executionPlanId` and `executionPlanHash`.
- Bind plan authority to branch, resolution, approved version, snapshot hash, evidence hash, proposed unit cost, and operator identity.
- Project explicit approval inputs and operation totals.
- Preserve `mutationPerformed: false` and `approvedForMutation: false`.

### Increment 3 — Controlled Execution

Transactional mutation integration.

Required capabilities:

- Require the exact approved plan authority.
- Reject stale or mismatched approval inputs.
- Enforce idempotency and duplicate-execution rejection.
- Use existing inventory transaction boundaries.
- Never rewrite existing StockMovement history.
- Never infer cost or apply a zero-cost fallback.

### Increment 4 — Post-Recovery Audit

Read/audit completion.

Required capabilities:

- Append immutable execution lifecycle evidence.
- Preserve actor, before/after authority, plan hash, timestamps, and result.
- Project resulting inventory state and execution result deterministically.
- Keep all reads branch-scoped.

## Safety Boundary

- No Production database mutation during development, CI, or ALDE certification.
- Preview and planning increments are strictly read-only.
- Stale data must abort; never refresh and continue silently.
- Branch means an independent tenant.
- Existing inventory and recovery contracts remain the authority.

## Verification

- Targeted contract tests for each increment.
- Branch-isolation and non-leaking 404 tests.
- Stale status/version/snapshot/evidence rejection tests.
- Deterministic preview and plan hash tests.
- Explicit no-mutation tests for preview and plan.
- Idempotent controlled-execution tests using Test DB authority only.
- Existing Missing Cost, Recovery, Inventory, Product, Prisma, and Backend regression gates.
- Backend CI.
- Local-main ALDE `Certify` with exact client/server SHA evidence before publication.

## Completion Authority

The mission is complete only when all four increments are implemented, Backend CI passes, the local main candidate is ALDE-certified with exact SHA evidence, publication race checks pass, and no Production mutation occurred.
