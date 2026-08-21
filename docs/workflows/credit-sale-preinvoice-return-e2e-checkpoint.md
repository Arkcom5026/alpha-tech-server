# Credit Sale Pre-Invoice Return E2E — Implementation Checkpoint

Status: **SERVER FEATURE BRANCH IN PROGRESS — NOT READY FOR MAIN**

Branch: `feature/credit-sale-preinvoice-return-e2e`

## Implemented in this checkpoint

- Shared return-aware credit receivable authority.
- Production reference projection for Sale 1046 / `SL-022608-0077`.
- Customer Money eligibility excludes returned quantity/value.
- Customer Money settlement write validation independently re-checks returned quantity/value and sale outstanding.
- Sale payment-close projection uses net receivable after returns.
- Unified delivery-note history preserves original total and exposes returned/billable/balance facts.
- Pure zero-refund SaleReturn remains valid and does not create refund evidence.
- SaleReturn runtime does not issue a tax credit note by itself.
- System Flow Note documents the before-tax and after-tax boundary.

## Intentionally unchanged

- `Sale.totalAmount` is not mutated.
- Stock restoration remains owned by Sale Return.
- Consolidated delivery remains document-only; no stock deduction is added.
- No new tax credit-note generation path is introduced.
- No schema migration is required by this checkpoint; returned value is derived from existing `returnedQuantity` + original sale-line value.

## Required verification before main

1. Run focused contracts:
   - `node tests/credit-receivable-authority.contract.test.js`
   - `node tests/credit-sale-preinvoice-return-e2e.contract.test.js`
   - `node tests/credit-sale-preinvoice-return-system-flow-note.contract.test.js`
   - existing delivery-credit settlement contract suite.
2. Run full server certification tests.
3. Prisma validate/generate as normally required by repository policy.
4. Verify Sale 1046 projection in a safe local/production-like environment:
   - gross `1810.00`
   - returned `640.00`
   - billable/outstanding `1170.00`
   - no refund transaction for the pure unpaid return
   - no tax credit note generated
5. Verify settlement cannot apply more than `1170.00` total and cannot select the fully returned Micro SD line.
6. Verify generated consolidated delivery contains only remaining active quantity/value and does not create any stock movement.

Do not merge or deploy until all verification passes.
