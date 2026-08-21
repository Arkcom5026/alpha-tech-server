# Delivery Note Lifecycle — Wave 2E Historical Revision Print

Status: IN PROGRESS — historical print projection implemented, awaiting focused local verification.

## Goal
Allow any persisted Delivery Note revision to be rendered as immutable historical evidence without restoring active business authority.

## Read contract
`GET /api/sales/:id/delivery-note/revisions/:revisionId/print`

The route is branch scoped and resolves the exact persisted revision by Sale + revision identity. The printable body uses the revision document number, issued date, frozen line snapshots and revision amounts.

## Historical safety
Historical print is evidence only. It must never reactivate a superseded, consolidated or cancelled revision. The projection therefore disables create-adjustment, consolidation and tax-handoff actions while explicitly allowing historical printing.

The current active Delivery Note endpoint remains unchanged: `GET /api/sales/:id/delivery-note` continues to resolve the current persisted revision first and legacy Sale-backed authority only when no persisted revision exists.

## Consolidation compatibility
The legacy base projector now accepts an internal `historicalRead` flag. Active requests keep the existing consolidation rejection. Historical revision printing may read issuer/recipient/presentation context even when the source Sale has already been consolidated.

## Replacement separation
Financial-lock `SaleDocumentReplacement` remains a different authority. Historical first-class Delivery Note revisions always use their own persisted line snapshots and clear replacement projection from the printable result.

## Reference case
For `SL-022608-0077`, revision 1 remains historically printable at gross 1,810 even after it becomes `SUPERSEDED`. Revision 2 is historically printable at active 1,170 with returned amount 640. Neither historical projection can be used to consolidate or hand off to tax authority.

## Deployment dependency
Wave 2 persistence migration must exist before deploying Wave 2C–2E runtime read routes. This wave does not deploy or run the migration.
