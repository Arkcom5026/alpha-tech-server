# Receipt Simple Transaction Runtime Migration

This increment relocates the existing Receipt Simple transaction implementation into the procurement module without changing transaction order, endpoint contracts, or response payloads.

## Runtime ownership

```text
/api/receipts-simple
→ src/modules/procurement/receipt/simple/routes/receiptSimpleRoutes.js
→ src/modules/procurement/receipt/simple/receiptSimpleController.js
→ src/modules/procurement/receipt/simple/runtime/receiptSimpleRuntime.js
```

## Preserved transaction effects

1. PurchaseOrder
2. PurchaseOrderItem
3. PurchaseOrderReceipt
4. PurchaseOrderReceiptItem
5. BranchInventory
6. StockMovement
7. InventoryTransaction
8. Payment when supplied

## Compatibility

A module-local Prisma adapter preserves the exact runtime implementation while allowing the original source blob to move without behavioral edits.

## Explicit exclusions

- no Prisma schema or migration changes
- no API URL changes
- no frontend changes
- no runtime or operational PASS claim
