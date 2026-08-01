# Missing Cost Resolution — Runtime Mutation Workflow

Related issue: #228

## Mission

Implement the branch-scoped runtime mutation workflow for Missing Cost Resolution on top of the certified domain, persistence, and read foundations, without mutating inventory.

## Increment Scope

- Create a draft resolution from an existing branch-owned candidate.
- Append immutable/versioned cost evidence.
- Submit a resolution for review.
- Approve, reject, return for correction, and cancel according to explicit lifecycle policy.
- Append one lifecycle audit event for every accepted transition.
- Enforce authenticated actor and current branch authority.
- Enforce expected status, current version, candidate snapshot hash, and evidence hash.
- Add mutation repositories, services, controllers, routes, and targeted tests.

## Lifecycle

- `DRAFT -> SUBMITTED`
- `SUBMITTED -> APPROVED`
- `SUBMITTED -> REJECTED`
- `SUBMITTED -> RETURNED_FOR_CORRECTION`
- `RETURNED_FOR_CORRECTION -> DRAFT`
- `DRAFT | RETURNED_FOR_CORRECTION -> CANCELLED` only when policy permits

Repeated or skipped transitions must fail deterministically.

## Evidence Rules

- Evidence history is immutable.
- Corrections create a new evidence version.
- Prior versions must never be updated or deleted.
- Approval records the exact approved evidence version and approval snapshot.
- Approval authorizes cost evidence only; it must not write inventory.

## Data Isolation

`Branch` means an independent store/tenant. Every command must derive `branchId` from the authenticated/current actor context and scope all reads and writes by that branch. Missing and cross-branch records must share the same non-leaking failure contract.

## Concurrency and Stale Data

Every command must validate the expected status/version and the relevant candidate/evidence hashes before writing. Stale commands must fail before any mutation. Accepted commands must update the resolution and append the audit event atomically.

## Safety Boundary

- No `SimpleLot` creation.
- No `StockMovement` mutation.
- No `StockBalance` mutation.
- No recovery preview, plan, or execution trigger.
- No automatic zero-cost fallback.
- No cross-store aggregation.
- No Production database mutation during development or certification.

## Verification

- Lifecycle policy contract tests.
- Repository atomicity and branch-isolation tests.
- Immutable evidence version tests.
- Optimistic/stale-data rejection tests.
- Route/authentication contract tests.
- Existing Missing Cost foundation, persistence, and read regressions.
- Existing inventory recovery regressions.
- Prisma multi-file validate/generate.
- Backend CI and startup verification.
- Post-merge ALDE `SyncAndCertify` with exact SHA evidence.

## Completion Authority

This increment is complete only after the PR is merged to `main`, Backend CI passes, ALDE `SyncAndCertify` succeeds for the merged server SHA, and evidence confirms that no inventory or Production mutation occurred.
