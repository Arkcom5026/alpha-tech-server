# Receipt Completion Vertical Slice

This increment extracts only receipt completion from the legacy root Barcode controller.

## Ownership

```text
PATCH /api/barcodes/receipts/:receiptId/complete
PATCH /api/barcodes/receipts/:id/complete
→ completion/receiptCompletionController.js
→ completion/receiptCompletionService.js
→ completion/receiptCompletionRepository.js
→ Prisma
```

## Preserved behavior

- canonical and legacy route aliases
- branch-scoped receipt validation
- `statusReceipt = COMPLETED`
- 404 when the receipt does not belong to the branch
- 409 when the guarded update affects no row
- response receipt projection: id, code and statusReceipt
- existing HTTP status and response contracts

## Root controller status

After route rewiring, `controllers/barcodeController.js` has no Barcode route ownership. Physical retirement remains a separate cleanup increment so repository-wide references can be proven absent before deletion.

## Explicit exclusions

- no endpoint or response change
- no lifecycle rule expansion
- no Prisma schema or migration change
- no root-controller deletion in this increment
- no Runtime PASS or Operational PASS claim
