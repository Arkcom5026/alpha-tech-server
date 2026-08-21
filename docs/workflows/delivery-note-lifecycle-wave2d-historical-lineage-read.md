# Delivery Note Lifecycle — Wave 2D Historical Revision Read + Lineage History

## Goal
Expose first-class Delivery Note revision history without changing financial, stock, return, settlement or tax authorities.

## Read contracts
- `GET /api/sales/:id/delivery-note/revisions` returns persisted revisions in revision order.
- `GET /api/sales/:id/delivery-note/revisions/:revisionId` returns one immutable revision snapshot with lines and Sale Return provenance.
- Every persisted revision remains historically readable, including `SUPERSEDED`, `CONSOLIDATED` and `CANCELLED` revisions.
- Only `CURRENT` is current action/presentation authority.
- A revision summary includes predecessor/successor lineage when present.
- When no persisted revision exists, revision history reports legacy fallback availability; the current Delivery Note GET route continues to resolve the legacy Sale-backed document.

## Reference case
For `SL-022608-0077`:
- revision 1: original Delivery Note, gross 1,810, later `SUPERSEDED`
- revision 2: `RETURN_ADJUSTMENT`, gross 1,810, returned 640, active 1,170, `CURRENT`
- revision 1 points to revision 2 as successor
- revision 2 points to revision 1 as predecessor
- both remain readable as immutable history

## Safety boundary
Wave 2D is read-only. It must not create/update/delete Delivery Note revisions, Sale, Sale Return, stock movement, payment, receivable, refund, settlement or tax records.

## Deployment dependency
Wave 2 persistence migration must exist before deploying these read routes because the endpoints query `DeliveryNoteDocument` tables.

## Deferred
- historical A4 rendering/print endpoint for a selected revision
- revision creation public API
- document-number generation policy
- client lifecycle/history UI
