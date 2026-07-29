# Barcode Print / Reprint Vertical Slice

This increment extracts barcode printing and reprinting capabilities from the legacy root Barcode controller.

## Ownership

```text
GET /api/barcodes/print-batch
GET /api/barcodes/with-barcodes
GET /api/barcodes/receipts-with-barcodes
GET /api/barcodes/reprint-search
PATCH /api/barcodes/mark-printed
PATCH /api/barcodes/reprint/:receiptId
→ print/barcodePrintController.js
→ print/barcodePrintService.js
→ print/barcodePrintRepository.js
→ Prisma
```

## Preserved behavior

- branch-scoped print batch loading
- auto-generation for receipts without barcode rows via the accepted Generation service
- pending print queue with SN/LOT and supplier credit projection
- robust receipt-id extraction for mark-printed
- atomic barcode and receipt printed-state update
- RC/PO/SUP/ALL reprint search modes
- printed flag behavior and limit clamp
- reprint fallback product and serial projection
- existing aliases, HTTP responses and no-cache headers

## Deliberately deferred

- scan readiness
- serial-number update
- barcode audit
- receipt completion

## Explicit exclusions

- no endpoint change
- no response contract change
- no duplicate generation/counter authority
- no Prisma schema or migration change
- no Runtime PASS or Operational PASS claim
