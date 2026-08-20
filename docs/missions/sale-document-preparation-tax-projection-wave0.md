# Sale Document Preparation + Tax Projection — Wave 0 Authority

Status: CONTRACT FOUNDATION / NO RUNTIME CUTOVER

## Mission

Introduce one branch-scoped mutable preparation draft between the immutable Sale/Stock truth and downstream Delivery Note / Tax projection, without creating a second Sale, Stock movement, Customer, Product, funding subsystem, revision history, or generic document engine.

## Canonical flow

`Sale / Stock truth -> one mutable preparation draft -> lock immutable snapshot -> tax projection`

The preparation draft is working data only. It is edited in place until locked. Unlike Quotation, no revision chain is retained because intermediate working drafts have no independent business value.

## Core invariants

1. Preparation must never mutate Sale, SaleItem, SaleItemSimple, Product, StockItem, SimpleLot, StockMovement, CustomerMoney, Payment, or revenue authority.
2. Exactly one active preparation draft is allowed per branch/source document authority.
3. Draft lines are manual document lines. They must not require Product, StockItem, SimpleLot, SaleItem, or SaleItemSimple relations.
4. `sourceTotal` is copied from the source transaction and is read-only inside preparation authority.
5. `documentTotal = SUM(preparation lines)`.
6. `documentTotal <= sourceTotal`.
7. `outOfBudgetTotal = sourceTotal - documentTotal`.
8. If `outOfBudgetTotal == 0`, only the agency/full-tax projection exists.
9. If `outOfBudgetTotal > 0`, a second short-tax projection exists for exactly that difference.
10. The short-tax difference is SERVICE-ONLY document data. It must never obtain Product/Stock identity or trigger inventory mutation.
11. `fullTaxTotal + shortTaxTotal == sourceTotal` at lock time.
12. Preparation stays mutable only while DRAFT.
13. Lock freezes one immutable business snapshot. No revision history is created.
14. Tax candidates may be created only from the locked snapshot, never from a live mutable preparation.
15. Once tax issuance authority is moved to a locked preparation, the original Sale tax source must not be issuable again for the same transaction.
16. FULL tax projection uses the organization/agency snapshot from the locked preparation.
17. SHORT tax projection must not require buyer/customer identity.
18. Existing Document Presentation V2 remains decoration/layout authority only and is not repurposed as business-line storage.
19. Existing Output VAT authority remains TaxDocument-based; this agenda must not create a second VAT ledger path.
20. All authority is branch-scoped.

## Explicit non-scope

- Quotation-style `revisionNumber`, `revisionRootId`, `revisedFromId`, `SUPERSEDED`, or revision history
- Funding-source master data
- Payer/contact relations
- New Customer records for out-of-budget amounts
- New Product or pseudo-stock records for document-only lines
- Rewriting Sale/Stock truth to match presentation lines
- Generic document engine
- Output VAT redesign
- Automatic Production migration/deploy

## Tax source identity direction

Current TaxCandidate uniqueness is `(branchId, sourceType, sourceId)`, so the locked preparation will project deterministic source identities for each tax portion rather than registering the same Sale twice.

Example:

- `DOCUMENT_PREPARATION:<preparationId>:IN_BUDGET`
- `DOCUMENT_PREPARATION:<preparationId>:OUT_OF_BUDGET`

The exact source type/name is finalized in the runtime wave, but the uniqueness and no-duplicate-tax-authority semantics are fixed by this Wave 0 contract.

## Wave 0 completion criteria

- dedicated feature branch
- architecture authority document committed
- executable contract test committed
- no schema migration
- no route/runtime cutover
- no main merge or production deployment
