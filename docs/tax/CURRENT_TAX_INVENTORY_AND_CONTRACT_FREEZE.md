# Alpha-Tech Tax Platform — Current Tax Inventory and Contract Freeze

Status: Slice 1 — Repository Gate
Branch: `feature/tax-platform-authority`
Scope: Backend inventory only; no Prisma mutation in this slice.

## 1. Purpose

This document freezes the observable tax behavior that must remain compatible while Alpha-Tech transitions from transaction-owned tax fields to an independent Tax Authority.

The current implementation is a tax-enabled transaction system. Sales and procurement records currently carry tax fields and tax-reporting responsibilities directly. The transition must be additive first and must not break existing sale completion, purchase receipt, printing, or report workflows.

## 2. Current backend tax surfaces

### 2.1 Sales source

Primary source: `prisma/schema.prisma`

Current `Sale` tax-relevant fields include:

- `totalBeforeDiscount`
- `totalDiscount`
- `vat`
- `vatRate`
- `totalAmount`
- `isTaxInvoice`
- `officialDocumentNumber`

Current sale line models also retain line VAT values through `vatAmount`.

Current operational code paths include:

- `src/modules/sales/create/controllers/saleLegacyCreateController.js`
- `src/modules/sales/completion/contracts/saleCompletionContract.js`
- `src/modules/sales/completion/services/saleCompletionService.js`
- `src/modules/sales/shared/saleLegacyProjection.js`
- `src/modules/sales/history/controllers/saleHistoryController.js`

### 2.2 Output tax reporting

Current code paths include:

- `controllers/salesReportController.js`
- `routes/salesReportRoutes.js`
- `routes/taxReportRoutes.js`

Current filing persistence includes:

- `SalesTaxFilingBatch`
- `SalesTaxFilingItem`

These records currently reference mutable business transactions rather than immutable tax ledger snapshots.

### 2.3 Purchase and input tax source

Primary source: `PurchaseOrderReceipt` in `prisma/schema.prisma`.

Current tax-relevant fields include:

- `supplierTaxInvoiceNumber`
- `supplierTaxInvoiceDate`
- `vatRate`
- `totalAmount`

Current operational code paths include:

- `controllers/purchaseOrderReceiptController.js`
- `src/modules/procurement/services/purchaseOrderService.js`
- `controllers/inputTaxReportController.js`
- `routes/inputTaxReportRoutes.js`
- `src/modules/product/trace/builders/productTraceProcurementBuilder.js`

Current filing persistence includes:

- `InputTaxFilingBatch`
- `InputTaxFilingItem`

### 2.4 Tax identity sources

Branch and customer master data currently provide tax identity fields, including tax ID, branch code, head-office indicator, company name, and structured address relations.

These records are mutable master data and therefore cannot become the durable legal representation of an already-issued tax document.

## 3. Current authority map

| Concern | Current owner | Target owner |
|---|---|---|
| Sale pricing and discount | Sales | Sales |
| Sale VAT calculation fields | Sales | Tax projection with compatibility fields retained during transition |
| Official tax document number | Sale | Tax Document Sequence |
| Customer tax identity at print time | Customer/Branch live data | Tax Party Snapshot |
| Supplier invoice identity | Purchase receipt | Input Tax Document Snapshot |
| Output tax report | Sales report controller | Tax Ledger / Tax Period |
| Input tax report | Input tax report controller | Tax Ledger / Tax Period |
| Filing batch | Filing models tied to source transaction | Immutable filing snapshot |
| Cancellation/correction | Distributed/implicit | Tax document lifecycle |

## 4. Frozen compatibility contracts

Until an explicit cutover slice is approved, the following behaviors are frozen:

1. Existing sale creation and completion APIs must continue to accept and return their current tax-related fields.
2. Existing purchase receipt APIs must continue to accept supplier tax invoice number/date and VAT rate.
3. Existing sales tax and input tax report endpoints must remain callable.
4. Existing bill and tax invoice printing must continue to render from current sale responses.
5. `officialDocumentNumber` and `isTaxInvoice` must not be removed or reinterpreted before a compatibility adapter is active.
6. Existing filing tables must not be deleted or repurposed in the additive foundation phase.
7. Existing report totals must not silently change due to new rounding, eligibility, or classification policy.
8. Existing sale, purchase, repair, and product-trace workflows must not depend on the new tax module until their contract handoff is explicit.

## 5. Known architectural risks

- Tax numbers are coupled to mutable business transactions.
- Issued documents can indirectly depend on current branch/customer master data.
- Input tax lacks explicit eligibility, prohibited VAT, and durable supplier snapshots.
- Filing models reference source transactions rather than ledger snapshots.
- Tax calculation, document issuance, report inclusion, and filing are not distinct lifecycle states.
- Correction, cancellation, replacement, credit note, and debit note authority is not centralized.
- Duplicate supplier tax invoice prevention is not represented as a dedicated tax invariant.
- Cross-module tax candidates have no shared intake contract.

## 6. Target boundary frozen by this slice

Business modules own business facts:

- Sales owns transaction, pricing, discount, payment, delivery, and sale completion.
- Procurement owns purchase ordering, receipt, supplier relationship, and inventory intake.
- Repair owns repair service facts and charges.
- Expense owns expense facts and payment evidence.

Tax owns legal-tax interpretation and durable tax state:

- candidate intake
- eligibility and classification
- tax document issuance
- numbering
- immutable party and line snapshots
- lifecycle and correction documents
- tax ledger
- reconciliation
- period close
- filing, settlement, and evidence

## 7. Transition rules

1. Add before remove.
2. Snapshot before cutover.
3. Dual-read or compatibility projection before changing existing consumers.
4. Tax documents never recompute legal history from mutable product, customer, supplier, or branch data after issuance.
5. Source modules publish facts; they do not directly decide filing inclusion.
6. Prisma schema execution remains a Local Runtime Gate owned by the user.

## 8. Slice 1 completion criteria

- Current backend tax surfaces identified: PASS
- Current authority conflicts identified: PASS
- Compatibility contracts frozen: PASS
- Target ownership boundary recorded: PASS
- Prisma changed: NO
- Runtime certification: NOT APPLICABLE

## 9. Next slice

Slice 2 creates the backend Tax Module Skeleton with contracts, policies, services, projections, routes, and a compatibility boundary. It must remain persistence-neutral until the Prisma foundation handoff.
