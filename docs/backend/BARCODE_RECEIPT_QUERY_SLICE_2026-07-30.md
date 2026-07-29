# Receipt Barcode Query Vertical Slice

This increment extracts only the `GET /api/barcodes/by-receipt/:receiptId` query capability from the legacy root Barcode controller.

## Ownership

```text
GET /api/barcodes/by-receipt/:receiptId
→ query/receiptBarcodeQueryController.js
→ query/receiptBarcodeQueryService.js
→ query/receiptBarcodeQueryRepository.js
→ Prisma
```

## Preserved behavior

- receipt and branch validation
- `kind=SN|LOT`
- `onlyUnscanned`
- `onlyUnactivated` for LOT rows
- `includeFallback` best-effort stock-item projection
- product-name batch resolution
- stock status, sold date and latest sale-item projection
- LOT label quantity suggestion
- no-cache headers and existing response contract
- auto-generation when the receipt has no barcode rows

## Cross-slice reuse

Auto-generation delegates to the accepted Barcode Generation service. Query does not duplicate counter, generation, or createMany authority.

## Deliberately deferred

- print batch
- receipt listing
- print and reprint
- scan readiness and serial update
- audit
- receipt completion

## Explicit exclusions

- no endpoint change
- no response contract change
- no root controller retirement yet
- no Prisma schema or migration change
- no Runtime PASS or Operational PASS claim
