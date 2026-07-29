# Store Customer Backfill and Audit Foundation — Execution Mission

## Role and Execution Model

The primary Chat task is the operational owner of this increment. Task Work is used only for Local Runtime, database execution, or capabilities unavailable through the current GitHub session.

## Authority Chain

```text
Issue #69 Commerce Product Blueprint
→ Issue #71 Commerce Platform Foundation
→ PR #85 Customer Platform / Store Architecture Authority
→ PR #86 Store Customer Prisma Foundation
→ this increment
```

## Mission

Create the additive persistence and contract foundation required to analyze and later migrate legacy `CustomerProfile` records into store-owned `StoreCustomer` records without performing the actual production backfill or changing runtime authority.

The increment must make future migration deterministic, auditable, resumable, and safe when one legacy customer appears across multiple branches.

## Preserved Authority

```text
CustomerProfile = active legacy runtime authority
StoreCustomer    = additive future store-owned foundation
```

No runtime consumer may switch to `StoreCustomer` in this increment.

## Authorized Scope

The implementation may add only the following additive concepts, with naming adjustments allowed when required by existing repository conventions:

- `StoreCustomerBackfillRun`
- `StoreCustomerBackfillCandidate`
- `StoreCustomerBackfillDecision`
- enums for run status, candidate status, and decision/action classification
- reverse relations required by the new models
- one additive Prisma migration
- focused contract verification
- repository scripts needed to run focused verification

A read-only analysis/report generator may be added only when it does not write to the database and does not depend on production credentials.

## Required Domain Semantics

### Backfill Run

A run represents one bounded discovery or migration-planning execution.

It should record at minimum:

- unique identifier
- status lifecycle
- source authority/version or source snapshot marker
- startedAt, completedAt, failedAt
- counts for scanned, eligible, ambiguous, skipped, and failed records where appropriate
- dry-run indicator
- optional error/summary metadata
- createdAt and updatedAt

### Backfill Candidate

A candidate represents one proposed mapping from a legacy customer context to a store-owned customer context.

It must preserve enough evidence to answer:

- Which legacy `CustomerProfile` was examined?
- Which branch/store relationship caused the candidate to exist?
- Which future `StoreCustomer` is proposed or created later?
- Was the candidate deterministic, ambiguous, skipped, rejected, or approved?
- What evidence and reason produced that state?

The candidate must support one legacy customer producing multiple branch-specific candidates. Do not enforce one global StoreCustomer per legacy CustomerProfile.

### Decision / Audit Record

A decision record must be append-oriented and auditable. It should capture:

- candidate
- decision/action
- reason code and optional note
- actor identity when available
- decision timestamp
- previous and resulting state where useful

Do not implement automatic identity linking. A phone/email match is evidence only and never ownership proof.

## Required Invariants

1. Every candidate is store/branch scoped.
2. Cross-store candidate discovery must not expose unrelated customer data.
3. One legacy `CustomerProfile` may produce zero, one, or many store candidates.
4. Re-running analysis must be idempotent or detect duplicates deterministically.
5. No candidate may alter `CustomerProfile`, existing `customerId` relations, or transaction ownership.
6. No candidate may create `StoreCustomerIdentityLink` automatically.
7. Ambiguous candidates must remain reviewable rather than guessed.
8. Audit history must not be silently overwritten.
9. The schema must support dry-run before any future write backfill.
10. Production backfill is explicitly forbidden in this increment.

## Recommended Uniqueness Strategy

Use a deterministic source key capable of distinguishing at least:

```text
(backfillRunId, legacyCustomerProfileId, branchId)
```

or an equivalent stable candidate fingerprint.

Do not add uniqueness that collapses the same legacy customer across different branches.

## Migration Safety

The migration must be:

- additive and non-destructive
- free of data updates or inserts
- free of modifications to existing customer foreign keys
- free of runtime cutover
- explicit about foreign-key delete behavior
- safe to inspect without connecting to production

No SQL backfill statement is authorized.

## Verification Requirements

Run and report:

```text
npx prisma format
npx prisma validate
npx prisma generate
focused backfill/audit contract verification
repository test command
git diff --check
```

If repository-wide tests fail for proven baseline reasons, report the exact failures separately and do not misclassify them as increment regressions.

Focused verification must prove at minimum:

- run, candidate, and decision/audit concepts exist
- candidate ownership includes branch/store scope
- legacy customer and branch can be represented together
- duplicate prevention does not collapse cross-branch candidates
- no migration statement updates or inserts legacy data
- no `CustomerProfile` alteration
- no legacy `customerId` field change
- no automatic `StoreCustomerIdentityLink` creation

## Explicit Non-goals

- executing database backfill
- creating StoreCustomer rows from legacy data
- runtime reads/writes through StoreCustomer
- Repair/Claim cutover
- Sales/Finance/Tax cutover
- customer merge execution
- OTP or verified identity workflow
- production deployment
- merging dependent PRs

## Evidence Report

Return:

```text
Branch:
Base SHA:
Implementation Commit SHA:
Remote Head SHA:

Files changed:

Models/enums/relations added:

Migration path and SQL safety review:

Verification:
- prisma format
- prisma validate
- prisma generate
- focused contract
- repository tests
- git diff --check

Scope confirmation:
- CustomerProfile unchanged
- legacy customerId unchanged
- no inserts/updates/backfill
- no runtime cutover
- no automatic identity linking

Baseline failures:
Scope deviations:
Remaining risks:
```

## Acceptance Criteria

This increment passes when the repository contains an additive, validated, audit-ready backfill planning foundation that can represent branch-specific migration candidates and human/system decisions without changing existing runtime behavior or customer data.
