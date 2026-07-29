# Input Tax Complete Agenda

## Working Policy

This branch is the single working area for the remaining Alpha-Tech input-tax agenda.

No intermediate increment from this branch may be merged into `main`.

The branch may contain multiple complete and reversible commits, but merge authority is granted only when the entire input-tax agenda reaches Repository Complete status.

CI, automated tests, and build results are not merge gates for this agenda. Runtime and production verification are intentionally deferred until the complete agenda is merged and the system is tested by the owner in production.

## Existing Foundation

`INPUT_TAX_OVERVIEW_V1` foundation was merged through PR #73 and is the starting authority for this branch.

## Completion State

All repository-scoped agenda items are implemented on this branch. The remaining gate is owner production verification after merge.

1. Reconciliation, eligibility, duplicate, replacement, and period-view projections: complete.
2. TaxDocument-centric filing persistence with legacy receipt compatibility: complete.
3. Period close/reopen authority: uses branch-scoped `TaxPeriod` persistence and lifecycle endpoints.
4. Filing selection/removal is blocked for `CLOSED`, `LOCKED`, and `SUBMITTED` periods.
5. `INPUT_TAX_OVERVIEW_V1` remains additive and compatible; Control Center receives period authority metadata and stable period endpoints.
6. Repository integration evidence: focused contract test covers period authority, blocked mutations, contract compatibility, and production checklist.

## Owner Production-Verification Checklist

- Verify one OPEN monthly period per branch can be created and listed by an OWNER or MANAGER.
- Close the period and confirm filing selection and removal return `INPUT_TAX_PERIOD_MUTATION_BLOCKED`.
- Reopen the period and confirm selection/removal resumes without changing legacy `purchaseOrderReceiptId` records.
- Verify `INPUT_TAX_OVERVIEW_V1` retains its existing fields and the Control Center can read `periodAuthority` metadata.
- Verify branch isolation: an operator cannot administer or mutate another branch's period.
- Verify a rollback by reverting this single increment restores the prior repository behavior without database migration.

## Merge Authority

Merge into `main` is prohibited until all items above are complete or explicitly removed from scope by the product owner.

The final PR must record:

- complete scope and architecture
- files changed
- migrations and compatibility strategy
- hybrid state removed or intentionally retained
- runtime impact
- deferred production verification
- production verification checklist
- rollback considerations
