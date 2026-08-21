# Delivery Note Lifecycle — Wave 2F Revision HTTP + Numbering

Status: IMPLEMENTED ON FEATURE BRANCH — LOCAL VERIFICATION PENDING

## Goal
Expose the first server-side command for issuing a return-adjusted Delivery Note revision while keeping numbering, source authority, and transaction semantics entirely server-owned.

## HTTP command
`POST /api/sales/:id/delivery-note/revisions`

The request does not accept a document number. Branch and employee authority come from the authenticated request context.

## Numbering policy
The original issued Delivery Note number remains immutable. Later revisions use a deterministic suffix based on the original number and monotonic revision number:

- revision 1: `DN-SL-022608-0077`
- revision 2: `DN-SL-022608-0077-R2`
- revision 3: `DN-SL-022608-0077-R3`

The number is derived inside the SERIALIZABLE revision transaction after the current predecessor is resolved. The client cannot choose or override it.

## Reference case
For `SL-022608-0077`, after the APACER return of 640, the first adjusted document becomes revision 2 with active amount 1,170 and number `DN-SL-022608-0077-R2`.

## Safety boundaries
The command reuses Wave 2B authority and therefore blocks already-consolidated sources, already-issued tax authority, missing completed Return evidence, no-change revisions, and zero-line/all-returned revisions.

It must never create another Sale, restore or deduct stock, mutate Sale totals, post payment/receivable/refund/settlement, or issue tax documents.

## Deployment dependency
Do not deploy this command before the Wave 2 persistence migration is applied. Client UI remains deferred until server write-path verification and migration readiness are closed.
