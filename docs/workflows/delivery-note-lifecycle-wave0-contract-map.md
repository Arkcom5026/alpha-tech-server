# Delivery Note Lifecycle — Wave 0 Archaeology & Contract Map

Status: WAVE 0 ARCHAEOLOGY COMPLETE — CONTRACT MAP / NO RUNTIME MUTATION

## Objective

Freeze the current production authorities before introducing Delivery Note lifecycle persistence. Wave 0 maps the existing issuance, print, return, replacement, settlement, consolidation, history and tax boundaries and records where the current implementation is still Sale-centric.

This document is descriptive evidence. It does not grant a new runtime authority by itself.

## Current authority map

| Concern | Current authority | Key implementation | Wave 0 finding |
| --- | --- | --- | --- |
| Delivery Note issuance | `Sale.officialDocumentNumber` | `src/modules/sales/documents/issue/issueSaleDeliveryNoteService.js` | Delivery Note identity is still stored on Sale. There is no first-class Delivery Note aggregate. |
| Delivery Note print | Sale projection + optional locked replacement projection | `src/modules/sales/documents/print/projectSaleDeliveryNoteService.js` | Base print lines are still original Sale lines; return quantities are not part of the base print projection. |
| Return / stock restoration | `SaleReturn` + `SaleItem.returnedQuantity` / `SaleItemSimple.returnedQuantity` | `src/modules/sales/return/services/saleReturnService.js` | Return authority is already canonical and must not be duplicated by Delivery Note lifecycle. |
| Return-aware receivable | Shared credit receivable authority | `src/modules/sales/shared/creditReceivableAuthority.js` | Net billable and outstanding values are already return-aware. |
| Delivery-credit settlement eligibility | Customer Money settlement projection | `src/modules/customer-money/settlement/delivery-credit/listEligibleDeliveryCreditsService.js` | Active remaining quantities/values are already calculated after returns and should be reused as a lifecycle input. |
| Existing document preparation | `SaleDocumentPreparation` | `src/modules/sales/document-preparation/documentPreparationService.js` | Preparation is tied to Sale gross total and locked source financial facts. |
| Existing replacement lineage | `SaleDocumentReplacement` / `SaleDocumentReplacementLine` | `prisma/commerce/sale-document-preparation.prisma`, `src/modules/sales/document-replacement/*` | Useful revision/lineage infrastructure already exists, but it is a financial-lock presentation recomposition authority, not a return-adjustment authority. |
| Manual consolidated Delivery Note | `CombinedBillingDocument` + `ConsolidatedDeliveryLine` | `src/modules/finance/combined-billing/documentWorkspaceService.js` | Current manual workspace projects original Sale quantity/price and is not return-aware. |
| Settlement-driven consolidated Delivery Note | `CombinedBillingDocument` + `ConsolidatedDeliveryLine` | `src/modules/finance/combined-billing/create/createSettlementConsolidatedDelivery.js` | Uses settlement `prepared` snapshots, which are return-aware after the pre-invoice return agenda. |
| Delivery Note history | Unified Sale + consolidated projection | `src/modules/finance/combined-billing/unifiedDocumentHistoryController.js` | Return-aware totals exist, but consumed source Sales are suppressed from the active list rather than represented as historical lifecycle rows. |
| Consolidated history/print | `CombinedBillingDocument` | `src/modules/finance/combined-billing/documentHistoryController.js` | Consolidated document has its own historical identity and source-line trace. |
| Tax handoff | `TaxCandidate` / `TaxDocument` | `src/modules/tax/documents/issue/issueOutputTaxDocumentService.js` | Tax already supports authority migration from SALE to DOCUMENT_PREPARATION or CONSOLIDATED_DELIVERY and blocks duplicate Sale issuance after consolidation. |
| Client Delivery Note list | Sale-document search policy | `src/features/deliveryNote/pages/DeliveryNoteListPage.jsx` and search policy | UI remains Sale-centric and primarily print-only. |
| Client Delivery Note print | Sale route `delivery-note/print/:saleId` plus consolidated adapter | `src/features/deliveryNote/pages/PrintDeliveryNotePage.jsx` | Route identity is still Sale-based for non-consolidated documents. |
| Client replacement UI | Financial-lock document replacement | `DeliveryNoteReplacementPanel.jsx` | Existing “ฉบับทดแทน” is for recomposition with unchanged locked financial totals, not return-adjusted replacement. |

## Major archaeology findings

### A. Delivery Note is not yet a first-class document identity

The canonical issue path writes a generated Delivery Note number into `Sale.officialDocumentNumber`. The canonical print route takes a `saleId`. This means the current system can represent one primary issued Delivery Note identity per Sale but cannot naturally represent an original Delivery Note plus one or more adjusted Delivery Note revisions as peer document records.

Compatibility consequence: Wave 1/2 must preserve the current Sale-based identity as a legacy adapter/backfill source while introducing lifecycle resolution. Existing URLs and printed historical documents must continue to work during migration.

### B. Existing replacement lineage is valuable but has a different business contract

`SaleDocumentReplacement` already has `replacementNumber`, `replacesReplacementId`, `currentKey`, `supersededAt`, `cancelledAt`, `financialLock`, and frozen `finalSnapshot`. This is strong lineage infrastructure and should be reused conceptually where it fits.

However, the replacement policy explicitly prevents source-line identities on replacement lines and requires recomposed totals to equal the locked original financial authority. Therefore it cannot directly model the reference return case where original Delivery Note value `1,810.00` becomes a new active Delivery Note value `1,170.00` after a `640.00` return.

Wave 1 must keep two concepts distinct:

- **financial-lock replacement** — presentation/recomposition with unchanged financial authority;
- **return-adjusted Delivery Note revision** — a new document lifecycle revision derived from remaining source quantities/value after a canonical Sale Return.

Do not weaken the existing financial-lock replacement rules merely to make return adjustment fit.

### C. There are currently two consolidation paths and they are not equivalent

1. Manual document workspace (`documentWorkspaceService.js`) builds line projections from original Sale `quantity` and `price` and currently does not select `returnedQuantity`.
2. Settlement-driven automatic consolidation (`createSettlementConsolidatedDelivery.js`) receives prepared settlement snapshots whose quantities and line amounts are already return-aware.

This divergence is the highest-risk structural finding in Wave 0. A returned line can be correctly excluded/reduced in settlement-driven consolidation while the manual workspace can still reason from original Sale quantities.

Wave 4 must converge both paths on one canonical active Delivery Note line projection. Until then, no opportunistic broad refactor should be made outside this lifecycle agenda.

### D. Return-aware financial authority already exists and should become an input, not be reimplemented

`creditReceivableAuthority.js` and delivery-credit settlement eligibility already derive:

- original quantity/value
- returned quantity/value
- active remaining quantity/value
- net billable value
- outstanding receivable

Wave 1 should define a document-line projection boundary that can reuse these facts. Delivery Note lifecycle must not create a second return or receivable calculation engine.

### E. Active history and historical lifecycle are currently different concepts

`unifiedDocumentHistoryController.js` suppresses source Sales that have active `ConsolidatedDeliveryLine` consumption. That is correct for preventing active reuse, but it means the current list is closer to an “active document workspace” than a full immutable lifecycle history.

Future document-centric history must be able to show both:

- the source historical Delivery Note with lifecycle status such as `SUPERSEDED` or `CONSOLIDATED`;
- the current replacement/consolidated document that owns downstream authority.

Historical visibility and active eligibility must therefore be separate policies.

### F. Tax authority already has a usable handoff model

Output tax issuance recognizes `SALE`, `DOCUMENT_PREPARATION`, and `CONSOLIDATED_DELIVERY` candidates. Once Sale lines are represented by an active consolidated Delivery Note, direct Sale tax issuance is blocked.

Wave 5 should extend/bridge this handoff to the future current Delivery Note lifecycle identity rather than creating a second tax engine. After a statutory Tax Invoice is issued, later returns continue through Credit Note/statutory correction authority.

## Existing production contracts that must remain compatible

- Issuing a Sale Delivery Note is branch-scoped, idempotent and document-only.
- Cancelled Sales cannot issue/print a Delivery Note.
- A valid credit Delivery Note does not depend on `Sale.status === COMPLETED`.
- Issuance/printing requires an issued document number.
- A source already consumed by active consolidation leaves active source print/consumption authority.
- Replacement/preparation financial-lock behavior must remain valid for its existing use case.
- Consolidation must remain stock-free and must not create a new Sale.
- Source lines cannot be actively consolidated twice.
- Tax authority cannot issue duplicate taxable authority across original Sale and active consolidated source.
- Cross-branch/customer source lineage remains forbidden.

## Data source-of-truth and migration constraints

Current evidence is distributed across existing aggregates:

- Sale: original transaction and current legacy Delivery Note number
- SaleItem / SaleItemSimple: original line identity + returned quantity evidence
- SaleReturn: return event/history and stock restoration authority
- SaleDocumentPreparation / SaleDocumentReplacement: locked presentation/recomposition lineage
- CustomerMoneySettlementLine: settlement consumption evidence
- CombinedBillingDocument / ConsolidatedDeliveryLine: consolidated document identity and source-line consumption trace
- TaxCandidate / TaxDocument: statutory source migration and issuance authority

Wave 2 must therefore be additive and non-destructive. Existing records must not require rewriting Sale history, Sale Return history, settlement history, consolidated lines, or issued Tax Documents.

## Recommended Wave 1 domain boundary

Before adding schema, define a pure lifecycle/domain layer with these responsibilities:

1. Resolve a legacy Sale-backed Delivery Note as a document identity.
2. Resolve current document status independently from `Sale.status`.
3. Resolve canonical active remaining lines from original lines minus canonical returned quantities and active downstream consumption.
4. Distinguish historical readability from active print/replace/consolidate eligibility.
5. Distinguish financial-lock replacement from return-adjusted revision.
6. Resolve one current active Delivery Note authority per lineage without deleting prior revisions.
7. Expose explicit transition reasons and downstream references.

Suggested first domain contracts:

- `resolveDeliveryNoteLifecycleStatus(...)`
- `projectActiveDeliveryNoteLines(...)`
- `assertDeliveryNoteRevisionEligible(...)`
- `assertDeliveryNoteConsolidationEligible(...)`
- `resolveCurrentDeliveryNoteAuthority(...)`

Names are provisional; behavior is the authority.

## Wave 1 entry criteria

Wave 0 is considered complete when:

- server/client route and source-of-truth map is recorded;
- existing replacement semantics are explicitly separated from return-adjusted revision semantics;
- manual vs settlement consolidation divergence is documented;
- current tax handoff is mapped;
- compatibility invariants are frozen by contract tests;
- no runtime/schema mutation is introduced as part of Wave 0.

These criteria are satisfied by this map plus the Wave 0 archaeology contract. Wave 1 may now design the lifecycle resolver and active-line projection before any persistence migration.
