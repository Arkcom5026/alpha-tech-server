# Delivery Note Lifecycle — Wave 2B Materialization & Revision Creation Authority

## Goal
Add the first transactional write authority for first-class Delivery Note revisions without exposing a public API yet.

## Runtime authority
`createReturnAdjustedDeliveryNoteRevision()` runs in a SERIALIZABLE transaction and:
1. validates branch/Sale/credit/issued-delivery-note ownership;
2. blocks a source already represented by an active consolidated delivery;
3. blocks a source that already owns an issued output tax document through SALE or DOCUMENT_PREPARATION authority;
4. materializes the legacy Sale-backed Delivery Note as immutable revision 1 when no lifecycle aggregate exists yet;
5. reads only COMPLETED Sale Returns as revision provenance;
6. derives current active lines from canonical Sale `returnedQuantity` evidence;
7. supersedes the previous CURRENT revision and clears its `currentKey`;
8. creates the next CURRENT revision with a new immutable document number, line snapshots and Return provenance.

## Reference case
`SL-022608-0077`:
- historical/original Delivery Note: 1,810;
- completed APACER return: 640;
- materialized revision 1: ORIGINAL / 1,810;
- adjusted revision 2: RETURN_ADJUSTMENT / 1,170;
- revision 1 becomes SUPERSEDED;
- APACER is absent from revision 2 active lines.

## Important invariants
- A revision number is monotonic within one Sale.
- A new revision may not reuse the predecessor document number.
- A return-adjusted revision requires at least one COMPLETED Sale Return.
- A revision is rejected when the active delivery state has not changed.
- A zero-line/all-returned revision is rejected.
- Financial-lock `SaleDocumentReplacement` remains a separate mechanism.
- Delivery Note revision creation never creates or mutates stock, Sale totals, payment, receivable, refund or tax events.

## Wave boundary
This wave deliberately has no route/controller/UI entry point. The Wave 2 migration remains undeployed until integration certification. Number allocation is accepted as an input to the service; canonical Delivery Note numbering policy is a later integration step.
