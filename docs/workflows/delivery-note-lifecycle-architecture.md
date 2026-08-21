# Delivery Note Lifecycle Architecture

Status: IN PROGRESS — architecture foundation

## Purpose

Elevate Delivery Note from a print projection of Sale into its own document lifecycle authority while preserving Sale as the immutable commercial transaction source.

This architecture must support:

- original delivery note history
- partial/full Sale Return awareness
- replacement/adjusted delivery notes
- consolidation of eligible unpaid delivery notes
- downstream consolidated delivery documents
- tax-document handoff
- immutable source trace across every transition
- no duplicate stock movement, receivable, settlement, or tax authority

## Core authority boundaries

1. Sale = transaction authority.
2. Sale Return = return/adjustment authority and stock restoration authority.
3. Delivery Note = document lifecycle authority.
4. Customer Money / Payment / Settlement = payment authority.
5. Tax Document = statutory tax authority.

A Delivery Note lifecycle transition MUST NOT mutate historical Sale gross totals or create stock movement unless the business operation itself is a stock operation.

## Historical rule

An issued Delivery Note is immutable historical evidence of what was delivered at that point in time.

A later return, replacement, consolidation, or tax issuance does not erase the historical document. Instead, the document acquires lifecycle state and immutable relations to downstream documents/events.

## Proposed lifecycle vocabulary

- ACTIVE — current delivery document with no later replacement/consolidation authority consuming it.
- ADJUSTED — source delivery has a return/adjustment affecting its current billable projection, but no replacement document has yet superseded it.
- SUPERSEDED — replaced by a newer delivery-note revision.
- CONSOLIDATED — its active remaining lines were consumed into a consolidated delivery document.
- CANCELLED — document was explicitly cancelled under a separate cancellation policy; not a substitute for return or replacement.

Lifecycle state is document authority and must not be inferred only from Sale.status.

## Replacement / adjusted delivery note flow

Example source:

- Sale gross: 1,810
- Returned value: 640
- Remaining billable value: 1,170

Flow:

Original Delivery Note 1,810
-> Sale Return 640
-> source Delivery Note becomes ADJUSTED
-> user may create Adjusted/Replacement Delivery Note
-> new Delivery Note contains only active remaining lines/value 1,170
-> source Delivery Note becomes SUPERSEDED
-> new Delivery Note becomes ACTIVE

Rules:

- no new Sale
- no new stock deduction
- no duplicate receivable
- original Sale.totalAmount remains historical gross
- replacement document carries immutable source-document and source-line trace
- returned quantities must not reappear in the replacement document

## Consolidation flow

Eligible unpaid/current Delivery Notes may be selected and consumed into one consolidated Delivery Note.

Rules:

- source documents remain historically readable
- consumed source lines cannot be consolidated again while the consolidated authority remains active
- consolidation uses current active remaining quantity/value, not original gross line values
- returned quantities are excluded before consolidation
- the consolidated document is document-only and MUST NOT create stock movement
- provenance must retain source Sale, source Delivery Note, source line, original quantity/value, returned quantity/value, and consumed quantity/value
- cancellation/reversal of consolidation requires an explicit reversal policy; it must not silently reactivate source authority when downstream tax authority already exists

## Tax handoff

Before tax invoice issuance:

Sale Return -> reduce billable/receivable authority -> Delivery Note may be adjusted/replaced/consolidated -> Tax Invoice may be created from the current active document authority.

After tax invoice issuance:

Return adjustment must follow Tax Document / Credit Note authority. Delivery Note lifecycle must not bypass statutory tax correction.

## Current schema evidence and gap

Existing Sale/SaleItem/SaleItemSimple already preserve returnedQuantity and Sale Return evidence.

Existing CombinedBillingDocument + ConsolidatedDeliveryLine already preserve source Sale/line identity and sourceSnapshot for consolidated delivery output.

However, current schema does not yet expose a first-class Delivery Note document aggregate with lifecycle identity/revision relations. Current delivery-note behavior is still substantially Sale-centric.

Therefore this agenda must first define the document aggregate and compatibility boundary before schema mutation.

## Required aggregate characteristics

A future Delivery Note aggregate should be able to represent:

- stable document identity/code
- branch/customer authority
- source Sale(s)
- issue timestamp
- lifecycle status
- revision lineage (`replaces`, `replacedBy` or equivalent event relation)
- document lines with immutable source trace
- gross/current/returned/consumed projections
- consolidation linkage
- tax-document linkage/readiness where applicable
- presentation snapshot/frozen document presentation compatibility
- actor/audit metadata

Do not duplicate existing Sale Return, Settlement, CombinedBilling, or Tax engines merely to support the Delivery Note lifecycle.

## Safety invariants

1. No source Sale is created when replacing a Delivery Note.
2. No stock movement is written when replacing or consolidating a Delivery Note.
3. No returned quantity can re-enter an active downstream Delivery Note.
4. No source line can be consumed twice by active replacement/consolidation authority.
5. A superseded/consolidated document remains historically readable.
6. Current billable authority must be return-aware.
7. Tax issuance uses current active eligible authority and cannot issue the same taxable source twice.
8. Cross-branch/customer document lineage is forbidden.
9. Existing production Sale/Delivery Note history must remain backward compatible during migration.

## UX direction

Delivery Note history should become document-centric in the same spirit as the sales-document history surface:

- each document row has its own type/status/actions
- ACTIVE: print/view
- ADJUSTED: view original, view return, create adjusted delivery note
- SUPERSEDED: view historical source, navigate to replacement
- CONSOLIDATED: view source history, navigate to consolidated document
- CANCELLED: history only unless explicit reversal authority permits otherwise

One Sale may legitimately have multiple Delivery Note revisions, but only the appropriate current document authority may proceed downstream.

## Delivery plan

### Wave 0 — archaeology and contract map

- map every server/client Delivery Note route, print projection, history query, consolidation path, settlement path, tax handoff, and existing compatibility dependency
- identify all Sale-centric assumptions
- identify current database source-of-truth and migration constraints
- produce contract tests that freeze existing production behavior before structural change

### Wave 1 — lifecycle domain foundation

- define lifecycle policy and transition authority
- define current/active document resolution
- define immutable lineage and line-consumption rules
- keep runtime behavior backward compatible

### Wave 2 — persistence / migration foundation

- introduce only the minimum first-class Delivery Note persistence needed by the lifecycle
- backfill/compatibility projection for existing Sale-based delivery notes
- no destructive migration

### Wave 3 — return-aware revision creation

- create adjusted/replacement Delivery Note from current remaining source quantities
- lifecycle transitions ADJUSTED -> SUPERSEDED / new ACTIVE
- no stock or receivable duplication

### Wave 4 — consolidation integration

- consolidate active remaining Delivery Note lines
- connect to existing CombinedBilling/ConsolidatedDeliveryLine authority rather than replacing it
- prevent duplicate consumption

### Wave 5 — tax handoff integration

- current active delivery authority becomes the source for eligible tax issuance
- preserve existing Credit Note/statutory correction boundary

### Wave 6 — client document history UX

- document-centric Delivery Note list/history
- lifecycle badges/actions/navigation
- explicit source/replacement/consolidation trace

### Wave 7 — operational verification and System Flow Note closure

- focused contracts
- module/full certification locally
- production-reference verification
- close with authoritative System Flow Note

## Task isolation

This branch is scoped only to Delivery Note Lifecycle Architecture.

Do not absorb unrelated employee-position, document-presentation, procurement, repair, or other parallel agenda changes except where an explicit compatibility dependency must be handled for this lifecycle. Any unrelated defect discovered during archaeology should be recorded for another agenda rather than opportunistically refactored here.
