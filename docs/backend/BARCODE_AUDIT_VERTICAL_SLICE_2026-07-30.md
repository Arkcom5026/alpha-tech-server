# Receipt Barcode Audit Vertical Slice

This increment extracts only receipt barcode audit from the legacy root Barcode controller.

## Ownership

```text
GET /api/barcodes/receipt/:receiptId/audit
→ audit/barcodeAuditController.js
→ audit/barcodeAuditService.js
→ audit/barcodeAuditRepository.js
→ Prisma read model
```

## Preserved behavior

- branch-scoped receipt validation
- optional `includeDetails`
- structured/simple/mixed/unknown classification
- StockItem, SimpleLot and barcode counts
- anomaly grouping and bounded examples
- existing anomaly names and response contract

## Deliberately deferred

- receipt completion

## Explicit exclusions

- no endpoint or response change
- no write operation in audit repository
- no Prisma schema or migration change
- no Runtime PASS or Operational PASS claim
