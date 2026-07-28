# Flexible Input Tax Receipt Links

## Scope / Mission
Provide an additive foundation for linking one input-tax document to one or more completed purchase receipts from both `PO_RECEIPT` and `QUICK_RECEIPT` sources.

## Architecture Goal
Make receipt-link rows and their allocations the workflow authority. `taxDocumentMode` remains receipt metadata and must not permanently prevent later link, unlink, correction, regrouping, or reallocation.

## Invariants

- Every linked receipt belongs to the same branch and supplier as the input-tax document.
- A tax document may include both receipt source types.
- A receipt may be allocated across tax documents, but active allocations must not exceed the receipt totals.
- Link cancellation is explicit and auditable; historical rows are not physically removed.
- Locked or submitted tax periods require a correction/replacement workflow rather than silent mutation.
- Legacy receipt and tax publication behavior remains backward compatible during migration.

## Planned Vertical Slice

1. Prisma models, enums, relations, indexes, and additive migration.
2. Tax-owned link lifecycle service/repository with transactional validation.
3. HTTP contract for attach, unlink, and receipt-link projection.
4. Contract verification and certification wiring.
5. Frontend API handoff after the backend contract stabilizes.

## Gate Status

- Gate A — Repository: IN PROGRESS
- Gate B — Runtime: PENDING LOCAL CERTIFICATION
- Gate C — Operational: PENDING RUNNING SYSTEM
