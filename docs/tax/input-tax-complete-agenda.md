# Input Tax Complete Agenda

## Working Policy

This branch is the single working area for the remaining Alpha-Tech input-tax agenda.

No intermediate increment from this branch may be merged into `main`.

The branch may contain multiple complete and reversible commits, but merge authority is granted only when the entire input-tax agenda reaches Repository Complete status.

CI, automated tests, and build results are not merge gates for this agenda. Runtime and production verification are intentionally deferred until the complete agenda is merged and the system is tested by the owner in production.

## Existing Foundation

`INPUT_TAX_OVERVIEW_V1` foundation was merged through PR #73 and is the starting authority for this branch.

## Remaining Definition of Done

1. Reconciliation and quality semantics
2. Eligibility authority
3. Partial eligibility
4. Duplicate detection authority
5. Replacement-document chain
6. Document, received, claim, and filed period views
7. Filing readiness
8. TaxDocument-centric filing persistence
9. Input-tax period closing and reopening
10. Frontend Input Tax Control Center contract readiness
11. Repository-level integration and final scope review
12. Production verification checklist for owner execution after merge

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
