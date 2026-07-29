# Barcode Scan / Serial Vertical Slice

This increment extracts barcode scan-readiness and serial-number update capabilities from the legacy root Barcode controller.

## Ownership

```text
GET /api/barcodes/ready-to-scan-sn
GET /api/barcodes/receipts-ready-to-scan-sn
GET /api/barcodes/ready-to-scan
GET /api/barcodes/receipts-ready-to-scan
PATCH /api/barcodes/update-serial-number
→ scan/barcodeScanController.js
→ scan/barcodeScanService.js
→ scan/barcodeScanRepository.js
→ Prisma
```

## Preserved behavior

- branch-scoped scan queues
- SN identity from `kind=SN` or linked StockItem without SimpleLot
- LOT identity from `kind=LOT` or linked SimpleLot
- pending SN from total minus linked StockItems
- pending LOT from total minus `SN_RECEIVED`
- 200 receipt limit and newest-first order
- barcode lookup restricted to branch
- serial update rejected when StockItem is missing
- serial update rejected when sold or `soldAt` exists
- serial uniqueness enforced within branch excluding current StockItem
- existing endpoint aliases and response contracts

## Deliberately deferred

- receipt barcode audit
- receipt completion

## Explicit exclusions

- no endpoint change
- no response contract change
- no print/query/generation rewrite
- no Prisma schema or migration change
- no Runtime PASS or Operational PASS claim
