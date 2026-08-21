# Delivery Note Lifecycle — Wave 1F Document Workspace Write Guard

## Goal
Harden manual consolidated-delivery confirmation so stale or crafted requests cannot consume returned Delivery Note quantities.

## Authority
The write path now reuses the same return-aware projection introduced for the Wave 1E read path.

For every requested source line the server derives:
- original quantity/value
- returned quantity/value
- active quantity/value
- active source unit price

A fully returned line is rejected with `DOCUMENT_WORKSPACE_SOURCE_RETURNED` before consolidated document creation.

For partially returned SIMPLE lines, `documentAmount` is calculated from the active quantity only. The persisted consolidated line quantity and source snapshot therefore represent the active remaining authority rather than the historical sold quantity.

## Reference case
`SL-022608-0077`
- historical gross: 1,810
- APACER returned: 2 x 320 = 640
- active remaining authority: 1,170
- returned APACER line: write rejected
- remaining SANDISK line: eligible according to existing settlement/payment rules

## Safety boundary
- no schema migration
- no inventory mutation
- no Sale total mutation
- no receivable mutation
- no duplicate return
- no adjusted Delivery Note persistence yet
- existing settlement, duplicate-document and tax guards remain in place

## Focused local verification
```powershell
node tests/delivery-note-lifecycle-wave1e-document-workspace-read-authority.contract.test.js
node tests/delivery-note-lifecycle-wave1f-document-workspace-write-guard.contract.test.js
node tests/consolidated-delivery-document-workspace.contract.test.js
node tests/delivery-note-lifecycle-wave1d-unified-history-integration.contract.test.js
```
