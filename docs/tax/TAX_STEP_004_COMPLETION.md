# Tax STEP 004 — Business Document Candidate Completion

## Authority

- Step Package: Alpha-Tech Step Package v0.1
- Increment: Tax Intake Foundation
- Branch: `feature/tax-intake-foundation`
- Scope: STEP 004 — Business Document Candidate

## Completed business flow

```text
Sale completion
  -> immutable Sale reference publication
  -> Tax public intake boundary
  -> idempotent candidate registration
  -> candidate-to-document mapping
  -> exactly one Tax Document identity
  -> initial lifecycle event
  -> publication evidence returned to Sales
```

## Acceptance evidence

1. Candidate registration identity is protected by branch + source type + source identity.
2. Candidate and Tax Document creation execute inside one Tax-owned transaction.
3. Replayed registration returns the previously linked candidate and document.
4. Sales depends only on the Tax public module entry and never writes Tax persistence directly.
5. Sale completion publishes only tax-ready immutable sale states.
6. Tax publication failure does not roll back an already committed Sale; the response exposes `PENDING_RETRY` evidence.
7. Repository migration creates the durable candidate, document, lifecycle-event tables, uniqueness constraints, and supporting indexes.
8. The frontend intake/review surface and backend query API were delivered earlier in Increment A.

## Gate status

- Repository Gate: PASS — structure, contracts, migration, API wiring, Sales publication wiring, contract tests, and branch diff verified.
- Runtime Gate: PENDING LOCAL EXECUTION — Prisma migration, backend certification command, and frontend lint/build require the local runtime.
- Operational Gate: PENDING LOCAL EXECUTION — authenticated Sale completion through API, Prisma, PostgreSQL, Tax query API, and frontend review must be exercised against a running system.

## Completion decision

STEP 004 is **Repository COMPLETE**. Increment A (STEP 001–004) may advance to STEP 005 after local Runtime and Operational Gate evidence is collected. Repository completion is not represented as local runtime certification.
