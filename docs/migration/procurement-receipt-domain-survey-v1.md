# Procurement Receipt Domain Survey v1

Status: Approved migration discovery baseline
Repository: Arkcom5026/alpha-tech-server
Scope: Purchase Order Receipt and Purchase Order Receipt Item runtime

## 1. Survey purpose

This document inventories the current legacy Purchase Order Receipt runtime before migration to `src/modules/procurement/receipt/`.

The migration must preserve current HTTP contracts and business behavior first. Structural improvement is allowed, but stock, purchase order, supplier payment, barcode, receipt status, branch scope, and pricing behavior must not change without an explicit later product decision.

## 2. Current runtime entry points

### Receipt routes

Source: `routes/purchaseOrderReceiptRoutes.js`

| Method | Route | Current handler | Feature class | Risk |
|---|---|---|---|---|
| POST | `/api/purchase-order-receipts` | `createPurchaseOrderReceipt` | Command | High |
| GET | `/api/purchase-order-receipts` | `getAllPurchaseOrderReceipts` | Query/List | Low |
| GET | `/api/purchase-order-receipts/ready-to-pay` | `getReceiptsReadyToPay` | Query/Finance projection | Medium |
| GET | `/api/purchase-order-receipts/with-barcode-status` | `getReceiptBarcodeSummaries` | Query/Print projection | Medium |
| GET | `/api/purchase-order-receipts/summaries` | `getReceiptBarcodeSummaries` | Alias | Medium |
| GET | `/api/purchase-order-receipts/receipt-barcode-summaries` | `getReceiptBarcodeSummaries` | Alias | Medium |
| POST | `/api/purchase-order-receipts/quick-receipts` | `createQuickReceipt` | Command/Quick intake | High |
| GET | `/api/purchase-order-receipts/:id` | `getPurchaseOrderReceiptById` | Query/Detail | Low |
| GET | `/api/purchase-order-receipts/:receiptId/items` | bridge to `getReceiptItemsByReceiptId` | Query/Items | Low |
| PATCH | `/api/purchase-order-receipts/:receiptId/items/:itemId` | bridge to `updateReceiptItem` | Command/Item update | High |
| PUT | `/api/purchase-order-receipts/:id` | `updatePurchaseOrderReceipt` | Command/Header update | Medium |
| DELETE | `/api/purchase-order-receipts/:id` | `deletePurchaseOrderReceipt` | Command/Delete | High |
| POST | `/api/purchase-order-receipts/:id/finalize` | `finalizeReceiptController` | Command/Finalize | Critical |
| PATCH | `/api/purchase-order-receipts/:id/finalize` | `finalizeReceiptController` | Backward-compatible alias | Critical |
| PATCH | `/api/purchase-order-receipts/:id/printed` | `markPurchaseOrderReceiptAsPrinted` | Command/Print status | Medium |
| POST | `/api/purchase-order-receipts/:id/generate-barcodes` | `generateReceiptBarcodes` | Command/Barcode generation | Critical |
| POST | `/api/purchase-order-receipts/:id/print` | `printReceipt` | Command/Print payload | Medium |
| POST | `/api/purchase-order-receipts/:id/commit` | `commitReceipt` | Command/Stock commit | Critical |

### Receipt item routes

Source: `routes/purchaseOrderReceiptItemRoutes.js`

| Method | Route | Current handler | Feature class | Risk |
|---|---|---|---|---|
| POST | `/api/purchase-order-receipt-items` | `addReceiptItem` | Command/Add or upsert item | High |
| PUT | `/api/purchase-order-receipt-items/update` | `updateReceiptItem` | Command/Update | High |
| PATCH | `/api/purchase-order-receipt-items/update` | `updateReceiptItem` | Alias | High |
| GET | `/api/purchase-order-receipt-items/by-receipt/:receiptId` | `getReceiptItemsByReceiptId` | Query/List items | Low |
| DELETE | `/api/purchase-order-receipt-items/:id` | `deleteReceiptItem` | Command/Delete | High |
| GET | `/api/purchase-order-receipt-items/:id/po-items` | `getPOItemsByPOId` | Legacy query alias | Low |
| GET | `/api/purchase-order-receipt-items/po/:poId/items` | `getPOItemsByPOId` | Query/PO items | Low |

## 3. Feature inventory

### 3.1 Receipt list

Current owner: `getAllPurchaseOrderReceipts`

Responsibilities:

- Requires branch identity from token.
- Disables HTTP caching and conditional 304 behavior.
- Filters by `printed`.
- Searches by receipt code or purchase order code.
- Filters supplier by free-text name or supplier ID.
- Loads purchase order and supplier projection.
- Flattens Prisma rows to the existing FE response shape.

Primary Prisma models:

- `PurchaseOrderReceipt`
- `PurchaseOrder`
- `Supplier`

Target slice:

`src/modules/procurement/receipt/query/list/`

### 3.2 Receipt detail

Current owner: `getPurchaseOrderReceiptById`

Responsibilities:

- Validates receipt ID and branch identity.
- Loads branch-scoped receipt, receipt items, product/unit, PO, and supplier credit fields.
- Loads every receipt belonging to the same PO.
- Aggregates `SupplierPaymentReceipt.amountPaid` across those receipts.
- Adds `supplier.debitAmount` to the response.
- Optionally normalizes Prisma Decimal values to JavaScript numbers.

Primary Prisma models:

- `PurchaseOrderReceipt`
- `PurchaseOrderReceiptItem`
- `PurchaseOrderItem`
- `Product`
- `Unit`
- `PurchaseOrder`
- `Supplier`
- `SupplierPaymentReceipt`

Target slice:

`src/modules/procurement/receipt/query/detail/`

Important boundary note: supplier payment projection belongs to the detail query contract, but payment write ownership must remain outside the receipt command slices.

### 3.3 Eligible purchase orders and PO detail for intake

Current owners:

- `getEligiblePurchaseOrders`
- `getPurchaseOrderDetailById`
- `getPOItemsByPOId`

Responsibilities:

- Lists only branch-owned POs in `PENDING` or `PARTIALLY_RECEIVED`.
- Loads supplier and product metadata.
- Computes received quantity from receipt item history.
- Provides PO items for receipt entry.

Target slices:

- `receipt/query/eligible-purchase-orders/`
- `receipt/query/purchase-order-detail/`
- or one intake-context slice if the FE consumes them as one workflow.

Recommended decision: migrate these after receipt detail and before create receipt, because they are read-only dependencies of receipt creation.

### 3.4 Create PO receipt header

Current owner: `createPurchaseOrderReceipt`

Responsibilities:

- Parses PO ID, tax invoice fields, note, and received date.
- Requires token branch and employee IDs.
- Verifies the PO belongs to the branch.
- Generates receipt code `RC-{branch}{YYMM}-{running}`.
- Uses a Prisma transaction with up to three unique-code collision retries.
- Creates the receipt and connects branch, PO, and employee.
- Upserts branch cost prices for every PO item after the receipt transaction.

Primary Prisma models:

- `PurchaseOrder`
- `PurchaseOrderItem`
- `PurchaseOrderReceipt`
- `BranchPrice`
- `Employee`
- `Branch`

Target slice:

`receipt/create/`

Critical finding: Branch Price upserts currently occur after the receipt transaction and failures are swallowed as warnings. Migration must preserve this behavior initially or explicitly elevate it in a separately approved change. Do not silently move these writes into the receipt transaction during behavior-preserving migration.

### 3.5 Header update and delete

Current owners:

- `updatePurchaseOrderReceipt`
- `deletePurchaseOrderReceipt`

Responsibilities:

- Branch-scoped existence check.
- Header note update.
- Physical receipt deletion.

Target slices:

- `receipt/update-note/`
- `receipt/delete/`

Critical finding: delete currently has no explicit completed/committed/stock-effect guard in the controller. Migration must preserve the current contract first, but deletion requires a later safety review before Operational certification.

### 3.6 Receipt item add/update

Current owners:

- `addReceiptItem`
- `updateReceiptItem`

Responsibilities:

- Parses receipt, PO item, quantity, cost, and `forceAccept`.
- Enforces token branch scope.
- Blocks edits after receipt `COMPLETED`.
- Verifies the PO item belongs to the same PO as the receipt.
- Prevents edit after linked `StockItem` rows exist.
- Aggregates previously received quantity across branch receipts.
- Blocks over-receive unless `forceAccept=true`.
- Creates or updates the receipt item.
- Upserts `BranchPrice.costPrice` in the same transaction.

Primary Prisma models:

- `PurchaseOrderReceipt`
- `PurchaseOrderReceiptItem`
- `PurchaseOrderItem`
- `PurchaseOrder`
- `Product`
- `StockItem`
- `BranchPrice`

Target slices:

- `receipt/item/add/`
- `receipt/item/update/`

Important domain finding: current add is actually upsert-like by `(receiptId, purchaseOrderItemId)`. The migrated API must preserve status code behavior: 201 for create and 200 for update.

### 3.7 Receipt item list and delete

Current owners:

- `getReceiptItemsByReceiptId`
- `deleteReceiptItem`

Responsibilities:

- Branch-scoped receipt existence.
- Loads PO item, product, unit, PO code, and stock item links.
- Deletes only when no stock items exist.

Target slices:

- `receipt/item/query/list/`
- `receipt/item/delete/`

Critical finding: deletion checks linked `StockItem` only. LOT effects and barcode rows require explicit survey during the write migration.

### 3.8 Barcode status and print state

Current owners:

- `getReceiptBarcodeSummaries`
- `getReceiptSummaries`
- `markPurchaseOrderReceiptAsPrinted`
- `printReceipt`

Responsibilities:

- Lists receipt-level print queues.
- Counts requested quantity versus generated stock items.
- Maintains receipt Boolean `printed`.
- Returns ordered barcode print payload.
- Supports three aliases for barcode summary reads.

Primary Prisma models:

- `PurchaseOrderReceipt`
- `PurchaseOrderReceiptItem`
- `StockItem`
- `BarcodeReceiptItem`

Target slices:

- `receipt/print-status/query/`
- `receipt/print-status/mark-printed/`
- `receipt/print-status/print/`

Migration constraint: keep all three read aliases until FE usage is audited.

### 3.9 Barcode generation

Current owner: `generateReceiptBarcodes`

Responsibilities:

- Loads branch-owned receipt and resolves product mode.
- Maintains a `(branchId, yearMonth)` barcode counter.
- Generates one LOT barcode per SIMPLE receipt item.
- Generates quantity-based SN barcodes for STRUCTURED receipt items.
- Creates `BarcodeReceiptItem` rows in one transaction.

Primary Prisma models:

- `PurchaseOrderReceipt`
- `PurchaseOrderReceiptItem`
- `Product`
- `PurchaseOrderItem`
- `BarcodeCounter`
- `BarcodeReceiptItem`

Target slices:

- `receipt/barcode/generate/`

Critical finding: no visible idempotency guard prevents duplicate barcode generation for an existing receipt. This must be preserved during structural migration and separately reviewed as a product/data-integrity issue.

### 3.10 Commit stock effects

Current owner: `commitReceipt`

Responsibilities:

- Ensures barcodes exist, invoking the HTTP controller function directly when missing.
- Loads receipt items and product mode.
- SIMPLE path:
  - Creates `SimpleLot`.
  - Increments `StockBalance`.
  - Links LOT barcode rows to the lot.
- STRUCTURED path:
  - Creates one `StockItem` per quantity.
  - Links SN barcode rows to stock items.
- Marks receipt `COMPLETED`.

Primary Prisma models:

- `PurchaseOrderReceipt`
- `PurchaseOrderReceiptItem`
- `Product`
- `BarcodeReceiptItem`
- `BarcodeCounter`
- `SimpleLot`
- `StockBalance`
- `StockItem`

Target slices:

- `receipt/commit/` for behavior-preserving migration, followed by architectural consolidation with finalize only after contracts are proven.

Critical findings:

1. A controller calls another controller directly to generate barcodes.
2. Stock commit is the true stock mutation boundary.
3. Receipt completion occurs in commit, while a separate finalize endpoint can also mark the receipt completed.
4. Structured and simple stock paths have materially different invariants and should be owned by separate internal policies or strategies.

### 3.11 Finalize receipt and PO status

Current owners:

- `finalizePurchaseOrderReceiptIfNeeded`
- `finalizeReceiptController`
- `getReceiptPendingCounts`
- `computePoStatus`

Responsibilities:

- Counts pending SN and LOT barcode rows.
- Prevents manual finalize while pending barcode intake remains.
- Is idempotent when receipt is already completed.
- Marks receipt completed.
- Recomputes PO status from barcode receipt item completion.
- Attempts receipt and PO status update in one transaction.

Primary Prisma models:

- `PurchaseOrderReceipt`
- `PurchaseOrder`
- `PurchaseOrderReceiptItem`
- `BarcodeReceiptItem`

Target slice:

- `receipt/finalize/`

Critical finding: current finalize does not create stock. It only verifies barcode completion and updates receipt/PO statuses. Therefore, `commit` and `finalize` are distinct legacy commands even though their names overlap semantically. They must not be merged during initial migration.

### 3.12 Receipts ready to pay

Current owner: `getReceiptsReadyToPay`

Responsibilities:

- Branch and date filtering.
- Selects completed, not-paid receipts.
- Computes receipt total from item quantity and cost.
- Aggregates linked supplier payments.
- Calculates remaining amount and filters zero balances.
- Normalizes Decimal output.

Primary Prisma models:

- `PurchaseOrderReceipt`
- `PurchaseOrderReceiptItem`
- `PurchaseOrder`
- `Supplier`
- `SupplierPaymentReceipt`

Target slice:

- `receipt/query/ready-to-pay/`

Boundary: query belongs to Procurement Receipt projection, while payment mutation remains Supplier Payment ownership.

### 3.13 Quick receipt

Current owner: `createQuickReceipt`

Responsibilities:

- Creates a non-PO receipt with source `QUICK`.
- Optionally links supplier.
- Creates receipt and direct product items in one transaction.
- Accepts flags for later barcode behavior but does not execute them.

Primary Prisma models:

- `PurchaseOrderReceipt`
- `PurchaseOrderReceiptItem`
- `Product`
- `Supplier`
- `Branch`
- `Employee`

Target slice:

- `receipt/quick-create/`

Boundary decision: QUICK receipt is procurement intake but not PO receipt. Keep it under `procurement/receipt/quick-create` initially; do not force it into the PO create slice.

## 4. Current aggregate and state axes

The legacy runtime uses several independent state axes:

1. `PurchaseOrderReceipt.statusReceipt`
   - observed terminal value: `COMPLETED`
2. `PurchaseOrderReceipt.statusPayment`
   - observed terminal value: `PAID`
3. `PurchaseOrderReceipt.printed`
   - Boolean print state
4. `BarcodeReceiptItem.status`
   - observed values include `READY` and `SN_RECEIVED`
5. `BarcodeReceiptItem.kind`
   - `SN` or `LOT`
6. `PurchaseOrder.status`
   - `PENDING`, `PARTIALLY_RECEIVED`, `COMPLETED`

These axes must not be collapsed during migration.

## 5. Transaction map

| Feature | Current transaction | Atomic writes |
|---|---|---|
| Create receipt | Yes | Receipt creation and receipt code retry only |
| Create receipt branch prices | No, after transaction | One independent upsert per PO item; failures warned and ignored |
| Add receipt item | Yes | Receipt item create/update + branch price upsert |
| Update receipt item | Yes | Receipt item update + branch price upsert |
| Generate barcodes | Yes | Counter updates + barcode receipt rows |
| Commit receipt | Yes | SimpleLot/StockBalance or StockItem links + receipt completed |
| Finalize receipt | Yes | Receipt status + attempted PO status update |
| Quick receipt | Yes | Receipt + items |
| Mark printed | No | Branch-scoped updateMany then readback |
| Print receipt | No | Mark printed then load barcodes |

## 6. Critical invariants to preserve

- Every receipt query and command must be branch-scoped.
- Token identity is authoritative for branch and employee; request payload must not supply actor identity.
- PO receipt items must belong to the receipt's purchase order.
- Completed receipts cannot be edited.
- Receipt item quantity must not exceed ordered quantity unless `forceAccept=true`.
- Receipt item cost updates branch cost price.
- Stock-linked receipt items cannot be edited or deleted.
- SIMPLE products create a lot and update aggregate balance.
- STRUCTURED products create individual stock identities.
- Barcode counters are branch/month scoped.
- Finalize and commit must remain idempotency-sensitive.
- Existing route aliases and response shapes must remain stable in the first migration pass.

## 7. Approved target structure

```text
src/modules/procurement/
└── receipt/
    ├── contracts/
    ├── validators/
    ├── policies/
    ├── mappers/
    ├── query/
    │   ├── list/
    │   ├── detail/
    │   ├── eligible-purchase-orders/
    │   ├── purchase-order-detail/
    │   ├── ready-to-pay/
    │   └── barcode-summary/
    ├── create/
    ├── quick-create/
    ├── update-note/
    ├── delete/
    ├── item/
    │   ├── query/list/
    │   ├── add/
    │   ├── update/
    │   └── delete/
    ├── barcode/
    │   └── generate/
    ├── commit/
    ├── finalize/
    ├── print-status/
    │   ├── mark-printed/
    │   └── print/
    └── routes/
```

## 8. Migration increments

### Phase A — Read foundation

1. Receipt list
2. Receipt detail
3. Receipt item list
4. Eligible PO list and PO detail
5. Barcode summary queries
6. Ready-to-pay query

### Phase B — Low-impact commands

7. Update receipt note
8. Mark printed and print payload

### Phase C — Receipt construction

9. Create PO receipt header
10. Quick receipt creation
11. Add receipt item
12. Update receipt item
13. Delete receipt item
14. Delete receipt header

### Phase D — Stock preparation and mutation

15. Generate receipt barcodes
16. Commit stock effects
17. Finalize receipt and recompute PO status

### Phase E — Closure

18. Legacy reference audit
19. Legacy cleanup
20. Operational certification through actual PO receipt, SN receipt, LOT receipt, barcode print, stock availability, PO status, and supplier payment flows

## 9. First implementation increment

The first implementation increment is approved as:

`GET /api/purchase-order-receipts`

Target files:

```text
src/modules/procurement/receipt/query/list/
├── listPurchaseReceiptsController.js
├── listPurchaseReceiptsService.js
├── listPurchaseReceiptsRepository.js
└── listPurchaseReceiptsSlice.test.js
```

Route migration must preserve:

- Current route path.
- `verifyToken` middleware.
- `Cache-Control`, `Pragma`, `Expires`, and per-request ETag behavior.
- Branch scope.
- `printed`, `q`, `supplier`, and `supplierId` filtering.
- Ordering by `receivedAt desc`.
- Existing flattened array response.
- Existing 401 and 500 response contracts.

## 10. Review conclusion

Purchase Order Receipt is a Critical migration target. The legacy controllers currently combine HTTP handling, validation, domain policy, transaction orchestration, Prisma access, stock mutation, PO status projection, price mutation, payment projection, and barcode operations.

The module must be migrated incrementally. Read slices are safe first. Stock commit and finalize remain the final high-risk increments and must be locally and operationally verified before legacy cleanup.
