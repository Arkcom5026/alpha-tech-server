# Backend Domain Map — Stock / Procurement / Sales

Status: ACTIVE EXPANSION
Scope: alpha-tech-server backend understanding beyond Mission B Product Template / QuickStock.

This document extends `SYSTEM_MAP.md` by mapping the next important backend domains:

```txt
Stock Dashboard
StockItem Runtime
Purchase Order / Receipt
Sales Runtime
```

## 1. Stock Dashboard Domain

### Route

`routes/stockRoutes.js`

Mounted in `server.js` as:

```txt
/api/stock/dashboard
```

Endpoints:

```txt
GET /api/stock/dashboard/overview
GET /api/stock/dashboard/audit-in-progress
GET /api/stock/dashboard/risk
```

### Controller

`controllers/stockController.js`

Responsibilities:
- Dashboard is treated as a subset of Stock, not a separate module.
- All dashboard endpoints require branch scope.
- Reads real DB state with defensive fallbacks so dashboard blocks do not crash the page.

Important function map:

```txt
getStockDashboardOverview
  → branch-scoped overview
  → StockItem status groupBy for STRUCTURED
  → StockBalance aggregate for SIMPLE
  → SimpleLot aggregate for LOT
  → soldToday from stockItem.soldAt fallback updatedAt

getStockDashboardAuditInProgress
  → finds current StockAuditSession in DRAFT / IN_PROGRESS

getStockDashboardRisk
  → counts risk statuses LOST / DAMAGED / USED / RETURNED
```

### Runtime Meaning

Stock dashboard is a read/projection surface.

It should not mutate stock.

It reads these models:

```txt
StockItem
StockBalance
SimpleLot
StockAuditSession
```

Branch isolation source:

```txt
req.user.branchId || req.branchId
```

## 2. StockItem Runtime Domain

### Route

`routes/stockItemRoutes.js`

Mounted in `server.js` as:

```txt
/api/stock-items
```

Protected by `verifyToken`.

Endpoints:

```txt
POST   /api/stock-items/
PATCH  /api/stock-items/mark-sold
GET    /api/stock-items/by-receipt/:receiptId
GET    /api/stock-items/search
GET    /api/stock-items/available
DELETE /api/stock-items/:id
PATCH  /api/stock-items/:id/status
POST   /api/stock-items/by-receipt-ids
POST   /api/stock-items/receive-sn
POST   /api/stock-items/receive
POST   /api/stock-items/receive-all-no-sn
PATCH  /api/stock-items/update-sn/:barcode
```

The route includes `normalizeReceivePayload` so old and new FE payload shapes both work:

```txt
{ barcode: "...", serialNumber?: "..." }
{ barcode: { barcode: "...", serialNumber?: "..." } }
{ code: "...", serialNumber?: "..." }
```

### Controller

`controllers/stockItemController.js`

Responsibilities:
- Handles SN / Barcode receiving.
- Receives stock from PO receipt barcode workflow.
- Marks StockItems sold.
- Updates stock item status.
- Looks up StockItems by receipt / receipt ids / availability.
- Supports idempotent receiving for already-scanned items.

Important function map:

```txt
addStockItemFromReceipt
  → create StockItem from PurchaseOrderReceiptItem
  → enforces receipt belongs to branch
  → validates product matches PO line
  → prevents duplicate barcode

receiveStockItem
  → accepts normalized barcode payload
  → finds BarcodeReceiptItem
  → validates branch ownership
  → LOT path: updates BarcodeReceiptItem, upserts StockBalance, supplier credit
  → SN path: creates StockItem, links BarcodeReceiptItem, upserts StockBalance, supplier credit

receiveAllPendingNoSN
  → receives all pending barcode receipt items for a receipt
  → supports both STRUCTURED and SIMPLE despite legacy route name
  → creates StockItem or SimpleLot effects depending mode

markStockItemsAsSold
  → validates all ids are branch-owned and IN_STOCK
  → updates status to SOLD
  → rejects partial/race conflict with 409

updateStockItemStatus
  → allows controlled status update, but blocks SOLD path and points to mark-sold
```

### Stock Mutation Rule

Stock mutation must be branch scoped and should update the related runtime projection:

```txt
StockItem / SimpleLot
→ StockMovement when relevant
→ StockBalance
→ Supplier credit when tied to PO receipt
```

## 3. Procurement / Purchase Order Domain

### Route

`routes/purchaseOrderRoutes.js`

Mounted as:

```txt
/api/purchase-orders
```

Protected by `verifyToken`.

This file is an explicit hybrid migration example:

```txt
getAllPurchaseOrders       → new module v2
remaining PO operations    → legacy controller
receipt helper endpoints   → purchaseOrderReceiptController
```

Endpoints:

```txt
GET    /api/purchase-orders/
POST   /api/purchase-orders/
GET    /api/purchase-orders/by-supplier
POST   /api/purchase-orders/with-advance
GET    /api/purchase-orders/eligible-for-receipt
GET    /api/purchase-orders/:id/detail-for-receipt
PUT    /api/purchase-orders/:id
DELETE /api/purchase-orders/:id
GET    /api/purchase-orders/:id
PATCH  /api/purchase-orders/:id/status
```

### New Module Controller

`src/modules/procurement/controllers/procurementController.js`

Important active method:

```txt
getAllPurchaseOrders
```

Responsibilities:
- Uses `req.user.branchId` from token.
- Normalizes status query defensively.
- Calls `purchaseOrderService.getAllPurchaseOrders(branchId, status)`.
- Normalizes Decimal/BigInt-ish values for FE.

Other methods exist in the controller for future module migration:

```txt
createSupplier
checkCreditLimit
createPO
receivePO
settleDebt
getReceiptsForBarcode
getBarcodePreview
confirmBarcodePrinted
getPendingScanReceipts
```

These should not be assumed mounted unless verified in routes.

### Migration Meaning

Procurement is a clear example of the desired P1 migration style:

```txt
Legacy route remains stable
→ One endpoint moved to new module
→ Other endpoints stay legacy
→ No rewrite required
```

## 4. Purchase Order Receipt Domain

### Route

`routes/purchaseOrderReceiptRoutes.js`

Mounted as:

```txt
/api/purchase-order-receipts
```

Protected by `verifyToken`.

Endpoints:

```txt
POST  /api/purchase-order-receipts/
GET   /api/purchase-order-receipts/
GET   /api/purchase-order-receipts/ready-to-pay
GET   /api/purchase-order-receipts/with-barcode-status
GET   /api/purchase-order-receipts/summaries
GET   /api/purchase-order-receipts/receipt-barcode-summaries
POST  /api/purchase-order-receipts/quick-receipts
GET   /api/purchase-order-receipts/:id
GET   /api/purchase-order-receipts/:receiptId/items
PATCH /api/purchase-order-receipts/:receiptId/items/:itemId
PUT   /api/purchase-order-receipts/:id
DELETE /api/purchase-order-receipts/:id
POST  /api/purchase-order-receipts/:id/finalize
PATCH /api/purchase-order-receipts/:id/finalize
PATCH /api/purchase-order-receipts/:id/printed
POST  /api/purchase-order-receipts/:id/generate-barcodes
POST  /api/purchase-order-receipts/:id/print
POST  /api/purchase-order-receipts/:id/commit
```

### Runtime Meaning

Purchase receipt domain is the formal PO receiving workflow.

It coordinates:

```txt
PurchaseOrderReceipt
PurchaseOrderReceiptItem
BarcodeReceiptItem
StockItem / SimpleLot
StockBalance
Supplier payable / credit effects
Barcode printing state
Finalize / commit state
```

### Relationship to QuickStock

QuickStock is a fast operational intake workflow.
PurchaseOrderReceipt is formal procurement receiving workflow.

Both ultimately affect stock runtime:

```txt
StockItem / SimpleLot
StockMovement
StockBalance
BranchPrice where relevant
```

They must remain consistent but do not need to be merged immediately.

## 5. Sales Runtime Domain

### Route

`routes/saleRoutes.js`

Mounted as:

```txt
/api/sales
/api/sale-orders  (backward compatibility path)
```

Protected by `verifyToken`.

Endpoints:

```txt
POST /api/sales/
GET  /api/sales/
GET  /api/sales/return
GET  /api/sales/printable
GET  /api/sales/printable-sales
PUT  /api/sales/:id/document-lines
PUT  /api/sales/:id/document-descriptions
GET  /api/sales/:id
POST /api/sales/:id/mark-paid
```

### Controller

`controllers/saleController.js`

Responsibilities:
- Creates sales documents.
- Validates sale totals, VAT, discount, money fields.
- Validates branch and employee context.
- Validates item stockItemId list.
- Prevents duplicate stock item in one sale payload.
- Uses transaction to create Sale and SaleItems.
- Marks StockItems as SOLD.
- Writes StockMovement SALE rows.
- Optionally auto-creates Payment depending feature flag.
- Reads sale history and sale detail with normalized Decimal values.
- Supports document line editing via new module service.

Important dependencies:

```txt
src/modules/sales/contracts/saleDocument.include
src/modules/sales/services/saleDocument.service
```

### Sales Mutation Flow

```txt
Validate branch/employee/customer/payment mode
→ Validate money totals and VAT
→ Validate stockItemIds unique and available
→ Create Sale + items
→ Update StockItem status SOLD
→ Create StockMovement type SALE qty -1
→ Optional Payment auto-create
→ Return normalized sale document
```

### Important Safety Rules

- Sale is branch scoped.
- Sale item must reference `stockItemId`.
- StockItem must be `IN_STOCK` at sale time.
- Race/stock conflict throws `STOCK_CONFLICT`.
- `/sale-orders` remains backward compatibility path.
- `/return` must not be used for mark-paid; returns should have separate intent-specific route.

## 6. Cross-Domain Stock Runtime Model

Across QuickStock, PO Receipt, and Sale, stock runtime revolves around:

```txt
StockItem       = structured / item-level inventory
SimpleLot       = lot-level SIMPLE inventory
StockBalance    = branch/product aggregate availability
StockMovement   = audit log of stock changes
BranchPrice     = branch-specific price source
```

### Receive-side writers

```txt
QuickStock /existing
PO Receipt barcode scan
PO Receipt commit/finalize
StockItem receive-sn / receive-all-no-sn
```

### Sale-side writers

```txt
Sales createSale
StockItem mark-sold
```

### Read/projection surfaces

```txt
Product POS search
Product list
Stock dashboard
Ready-to-sell endpoints
Sale item selection
```

## 7. Updated Migration Understanding

New module migration is already happening in at least these areas:

```txt
src/modules/product
src/modules/quickStock
src/modules/procurement
src/modules/sales
```

But the production runtime still depends heavily on:

```txt
routes/
controllers/
```

Therefore the correct migration approach remains:

```txt
Route stability first
Controller as adapter
Module service when safe
Repository / engine extraction later
```

Do not delete or move legacy files merely because a new module exists.

## 8. Recommended Next Reads

To expand this map further, inspect next:

```txt
controllers/purchaseOrderReceiptController.js
controllers/purchaseOrderController.js
controllers/quickReceiptController.js
routes/quickReceiptRoutes.js
src/modules/procurement/services/purchaseOrderService.js
src/modules/sales/contracts/saleDocument.include.js
src/modules/sales/services/saleDocument.service.js
prisma/schema.prisma
```

## 9. Mission B Impact

This broader read reinforces that Mission B should not create another parallel stock flow.

QuickStock `/existing` already aligns with the broader backend stock model:

```txt
ProductTemplateEngine clone
→ BranchPrice upsert
→ StockItem / SimpleLot
→ StockMovement
→ StockBalance
```

Next step remains:

```txt
End-to-End Runtime Verification
```

not another implementation patch.
