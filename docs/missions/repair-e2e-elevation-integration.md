# Repair E2E Elevation Integration — Mission Pack

## Mission

Create a clean integration working area from the latest `main` for the completed Repair elevation increments.

## Why this integration branch exists

The original Repair Draft PRs were created while multiple parallel workstreams continued to advance `main`. They remain valid as isolated architecture and evidence records, but their branches are now behind the latest production baseline and must not be force-synchronized or merged directly.

## Authorized Integration Order

1. Repair Customer and Branch Isolation — Server PR #169
2. Repair Workflow Command Cutover — Server PR #172
3. Repair Intake Completion Authority — Server PR #173
4. Repair Capability-based Authorization — Server PR #174
5. Repair Control Center and SLA — Server PR #176

Client increments remain independently integrated in the client repository after the matching Server authority is ready.

## Safety Rules

- Start from latest `main`.
- Do not force-update original increment branches.
- Preserve original Draft PRs as architecture and implementation evidence.
- Replay changes in dependency order.
- Inspect the latest `main` version of every target file before applying a delta.
- Resolve semantic conflicts instead of copying stale whole files.
- Keep Prisma and production data unchanged unless a later mission explicitly authorizes them.
- Do not claim Runtime PASS without executable evidence.

## Focused Verification Gates

```text
node tests/repair-customer-branch-isolation.contract.test.js
node tests/repair-workflow-command-client-cutover.contract.test.js
node tests/repair-intake-completion-authority.contract.test.js
node tests/repair-capability-authorization.contract.test.js
node tests/repair-control-center-sla.contract.test.js
```

After focused verification, run repository module/runtime verification according to the Runtime Verification Workflow Standard.

## Original PR Disposition

Original Draft PRs remain open until their deltas are replayed and verified in this integration working area. They must not be closed or marked superseded prematurely.
