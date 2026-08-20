# Document Replacement / Recompose with Financial Lock — Wave 0 Authority

Status: CONTRACT FOUNDATION / NO RUNTIME CUTOVER

## Mission

Allow an already prepared/printed agency document set to be replaced when the agency procurement/warehouse team requests different document wording or line composition, while preserving all financial and tax authority exactly.

This agenda exists for real operational cases where the staff member who purchases or sends equipment for repair does not know the final budget category. The store must often issue a Delivery Note and Tax Invoice first, then later recompose the document lines after procurement/warehouse review.

## Canonical flow

`Sale / Stock truth -> locked Preparation A -> Delivery Note A + Tax Document A -> replacement request -> Replacement Draft B -> recompose presentation lines -> Financial Lock check -> lock B -> replacement Delivery Note B + replacement Tax Document presentation`

The original set is never deleted or rewritten. It remains immutable historical evidence.

## Core invariants

1. Sale, SaleItem, SaleItemSimple, Product, StockItem, SimpleLot, StockMovement, Payment, CustomerMoney and revenue truth must never be mutated by replacement.
2. Replacement is not Quotation revision. Do not introduce quotation-style revisionNumber/revisionRootId/revisedFromId semantics.
3. A replacement set must have explicit lineage to the exact locked preparation/document set it replaces.
4. The original locked preparation snapshot remains immutable forever.
5. The original TaxDocument financial fields and OutputVatRecord remain immutable.
6. Replacement may change presentation line descriptions, details, ordering, splitting, merging and document unit labels.
7. Replacement may not change the financial authority of any tax portion.
8. IN_BUDGET total must exactly equal the original locked IN_BUDGET total.
9. OUT_OF_BUDGET total must exactly equal the original locked OUT_OF_BUDGET total.
10. FULL/SHORT tax kind per portion must remain unchanged.
11. Subtotal, VAT and total per tax portion must remain unchanged to the cent.
12. `IN_BUDGET + OUT_OF_BUDGET == sourceTotal` must remain true.
13. Tax period / submitted VAT identity must never be changed by replacement.
14. If the original tax document has already been reported/submitted, replacement still cannot alter financial/tax facts; it is document representation replacement only.
15. OUT_OF_BUDGET remains SERVICE_ONLY. It must never gain productId, stockItemId, simpleLotId, saleItemId or SaleItemSimple identity.
16. IN_BUDGET replacement lines are detached document lines as well; no replacement line may mutate or relink inventory authority.
17. Replacement must preserve branch/tenant authority.
18. A replacement action requires actor, timestamp and reason.
19. Old document sets remain queryable for audit; only one set is current for operational printing.
20. Delivery Note and Tax Invoice replacement must be coordinated from the same replacement set so their presentation cannot drift independently.
21. Existing Document Presentation V2 remains layout/decorative authority only.
22. Existing TaxDocument/OutputVatRecord remain tax/accounting authority; do not create a second VAT ledger.
23. Runtime must fail closed if original financial facts cannot be reconstructed exactly.
24. No automatic production migration/deploy in this wave.

## Financial Lock

The replacement financial lock is derived only from the immutable original locked preparation/tax facts, never from editable replacement lines.

For each portion it freezes:

- portion identity: IN_BUDGET / OUT_OF_BUDGET
- required tax kind: FULL / SHORT
- subtotalAmount
- taxAmount
- totalAmount
- VAT rate
- source Sale identity
- original preparation identity
- original TaxDocument identity when available
- tax period/submission identity when available

Replacement draft lines are accepted only if their recomposed totals exactly match this lock.

## Recompose semantics

Allowed example:

Original IN_BUDGET 4,000:

- `อะไหล่เครื่องพิมพ์ 1 x 4,000`

Replacement IN_BUDGET 4,000:

- `วัสดุสำนักงาน 1 x 2,500`
- `วัสดุสิ้นเปลือง 1 x 1,500`

Forbidden:

- changing IN_BUDGET from 4,000 to 4,500
- changing OUT_OF_BUDGET from 1,000 to 500
- changing FULL to SHORT or SHORT to FULL
- changing VAT allocation
- moving amount between portions
- attaching product/stock identity to replacement lines

## Existing authority survey findings

1. Current `SaleDocumentPreparation` is unique per branch/source Sale and becomes immutable after `LOCKED`; this is correct and must not be reopened.
2. Current locked snapshot already carries source totals, taxProjection, vatAllocation and outOfBudgetService, making it the primary financial-lock source.
3. Current preparation tax registration creates deterministic per-portion TaxCandidates and TaxDocuments and reconciles totals/VAT back to the locked source.
4. Current TaxDocument already owns issued numbers, issuer/recipient snapshots, OutputVatRecord and filing links. Replacement must not mutate these authorities.
5. Current tax lifecycle supports cancellation but has no runtime replacement/recompose authority tied to locked preparation.
6. Prisma contains dormant enum vocabulary such as REPLACEMENT/VOID/REPLACED, but current runtime lifecycle does not use that enum as replacement authority. Wave 0 does not treat dormant enums as implemented behavior.
7. Client currently renders a LOCKED preparation read-only and routes tax draft creation through the existing Tax Intake path. This is the correct extension point for a future replacement action.
8. Current Delivery Note print projection already reads locked preparation lines instead of Sale lines, so replacement should extend the preparation projection boundary rather than reintroduce SaleItem mutation.

## Planned waves

### Wave 0 — Authority + pure financial-lock policy
- architecture contract
- pure financial-lock builder/validator
- executable contract tests
- no Prisma migration
- no routes/UI cutover

### Wave 1 — Persistence + lineage
- additive replacement aggregate
- replacement draft lines
- explicit original/replacement lineage
- actor/reason/audit metadata
- one-current-set authority

### Wave 2 — Server runtime
- create replacement from locked preparation
- edit replacement lines
- financial-lock validation
- lock replacement snapshot
- tax/document lineage guards

### Wave 3 — Tax replacement projection
- map replacement presentation to original TaxDocument financial authority
- preserve issued/submitted tax facts
- coordinate FULL/SHORT portions
- no duplicate Output VAT

### Wave 4 — Client workspace
- request replacement action from LOCKED state
- show immutable financial lock
- allow line recompose only
- coordinated Delivery Note + Tax Invoice replacement preview
- history/current-set visibility

### Wave 5 — E2E hardening
- equal-total replacement
- split/merge line replacement
- unequal FULL+SHORT replacement
- submitted-period replacement with unchanged VAT
- idempotency/concurrency/tenant isolation

## Wave 0 completion criteria

- dedicated feature branch
- authority document committed
- pure policy committed
- executable contract test committed
- no schema migration
- no route/runtime cutover
- no main merge or production deploy
