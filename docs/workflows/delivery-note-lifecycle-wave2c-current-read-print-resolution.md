# Delivery Note Lifecycle — Wave 2C Current Read / Print Resolution

## Goal
Make the existing Sale Delivery Note GET/print path resolve the current first-class Delivery Note revision when one exists, while preserving legacy Sale-backed behavior when no revision has been materialized.

## Resolution order
1. Look up `DeliveryNoteDocument.currentKey = branchId:saleId`.
2. If no persisted current revision exists, keep the legacy Sale-backed projection unchanged.
3. If a persisted current revision exists, keep legacy issuer/recipient/presentation compatibility but replace document identity, line snapshot and delivery amounts with the immutable current revision.

## Revision semantics
A persisted current revision is the printable document authority. Its immutable `documentNumber`, `issuedAt`, line snapshots, `grossAmount`, `returnedAmount` and `activeAmount` win over legacy Sale presentation lines.

If canonical Sale return evidence has advanced beyond the persisted revision's cumulative `returnedAmount`, the current revision is still the current historical document but its lifecycle is derived as `ADJUSTED`, signalling that another return-adjusted revision can be created. Otherwise its lifecycle is `ACTIVE`.

## Separation from financial-lock replacement
`SaleDocumentReplacement` remains a separate presentation/financial-lock authority. Once a first-class Delivery Note revision is selected, replacement lines must not overwrite that return-adjusted revision.

## Reference case
For `SL-022608-0077`, once revision 2 exists:
- document number = revision 2 immutable number
- gross = 1,810
- cumulative returned = 640
- active = 1,170
- printable lines exclude the fully returned APACER line
- the original Sale-backed document remains historical revision 1

## Safety boundary
Wave 2C is read-path integration only. It creates no revision, Sale, StockMovement, payment, receivable, refund or tax event. Historical revision selection by revision id is intentionally deferred to a later history endpoint wave.

## Deployment dependency
This read path queries the Wave 2 persistence tables. Do not deploy the runtime integration before the Wave 2 migration is applied in the target database.
