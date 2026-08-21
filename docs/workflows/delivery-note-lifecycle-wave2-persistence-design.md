# Delivery Note Lifecycle — Wave 2 Persistence Design

## Goal
Introduce first-class immutable Delivery Note document/revision persistence without changing current runtime behavior yet.

## Core model
- `DeliveryNoteDocument` is one immutable printable Delivery Note snapshot/revision.
- `DeliveryNoteDocumentLine` is the immutable line snapshot for that revision.
- `DeliveryNoteDocumentReturnSource` records every completed Sale Return that contributed to a revision.
- `replacesDocumentId` forms the revision chain.
- `currentKey` is nullable and unique. The current revision owns a stable `branchId:saleId` key; superseded/consolidated/cancelled revisions clear it.

## Persisted state versus derived lifecycle
Persisted state describes document consumption: `CURRENT`, `SUPERSEDED`, `CONSOLIDATED`, `CANCELLED`.
The higher-level lifecycle resolver may still present a current legacy/original document as `ADJUSTED` when a return exists but no successor revision has been issued yet.

## Compatibility and materialization
A legacy Sale-backed Delivery Note remains valid. When first-class revision creation is introduced in the runtime wave, the legacy original can be materialized as revision 1 and a return-adjusted document created as revision 2 within one serializable transaction.

Reference case `SL-022608-0077`:
- revision 1: historical gross 1,810 and original delivered lines; after revision issuance it becomes `SUPERSEDED`
- return source: completed return for APACER 640
- revision 2: active 1,170 and only the remaining active quantities/values

Multiple Sale Returns can contribute to one later revision, so return provenance is a junction table rather than a single `sourceReturnId` column.

## Authority boundaries
The persisted Delivery Note is presentation/history authority. It must never create a Sale, StockMovement, payment, receivable, refund, or tax event by itself.
Financial outstanding remains derived from Sale + Return + Settlement authorities. Tax remains owned by Tax Document authority.

## Separation from SaleDocumentReplacement
`SaleDocumentReplacement` remains the financial-lock presentation replacement mechanism. It is not Delivery Note return-adjustment lineage and is not reused as this aggregate.

## Numbering
Each revision receives its own immutable `documentNumber`. `revisionNumber` is monotonic only within `(branchId, saleId)`. Reusing one document number for different contents is forbidden.

## Wave 2 boundary
This wave adds schema, migration, invariants and contracts only. No API route or runtime write service creates these records yet. External Sale/Branch/Employee/SaleReturn references remain scalar identities in this first additive schema so existing model files do not require broad cross-domain edits in the persistence foundation; runtime services must enforce branch/source ownership before writes.