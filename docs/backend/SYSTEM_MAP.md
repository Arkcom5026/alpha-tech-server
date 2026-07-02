# Backend System Map — P1 / alpha-tech-server

Status: ACTIVE BASELINE
Purpose: Give new Tasks a backend boot map before Mission work.

This map is broader than `RUNTIME_MAP.md`.

- `RUNTIME_MAP.md` focuses on Mission B Product Template → Quick Receive → Stock Runtime.
- `SYSTEM_MAP.md` explains the current backend structure, route surface, migration model, and domain boundaries.

## 1. Backend Operating Model

P1 backend is a live production-style system using a hybrid architecture:

```txt
Legacy Production Runtime
  server.js
  routes/
  controllers/
  middlewares/
  lib/
  prisma/

New Module Runtime
  src/modules/product/
  src/modules/quickStock/
```

The migration strategy is not rewrite.

Approved strategy:

```txt
Keep production runtime stable
→ Add/repair workflow capability
→ Reuse new module when safe
→ Extract responsibility gradually
→ Keep every intermediate state deployable
```

## 2. Server Entry Point

### `server.js`

Responsibilities:
- Creates Express app.
- Configures request id.
- Loads route modules.
- Configures CORS.
- Mounts API routes.
- Provides `/healthz`.
- Provides 404 and error middleware.
- Starts HTTP server.

Important runtime conventions:

```txt
app.use('/api/products/template', templateProductSearchRoutes)
app.use('/api/products', productRoutes)
app.use('/api/quick-stock', quickStockRoutes)
app.use('/api/branch-prices', branchPriceRoutes)
app.use('/api/stock/dashboard', stockRoutes)
```

The backend already mixes legacy routes and new module routes in `server.js`. This confirms Hybrid Migration is the current production reality.

## 3. Shared Infrastructure

### `lib/prisma.js`

Responsibility:
- Exports singleton Prisma client.
- Exports Prisma namespace.

Preferred import:

```js
const { prisma, Prisma } = require('../lib/prisma')
```

New code should prefer the singleton unless a file already intentionally owns its own PrismaClient.

### `middlewares/verifyToken.js`

Responsibility:
- Validates JWT Bearer token.
- Normalizes role.
- Resolves profile context.
- Creates canonical `req.user`.

Important context fields:

```txt
req.user.id
req.user.role
req.user.profileType
req.user.profileId
req.user.activeProfileId
req.user.customerProfileId
req.user.employeeId
req.user.branchId
```

Important doctrine:
- P1 may have a single user who is both Customer and Employee.
- Employee context has priority when role/profile/employeeId indicates employee.
- Branch context is essential for POS and operational runtime.

## 4. Route Surface Map

### Identity / People / Auth

```txt
/api/auth
/api/employees
/api/customers
/api/customer-deposits
/api/customer-receipts
/api/address
/api/locations
/api/positions
```

### Product Catalog / Product Runtime

```txt
/api/product-types
/api/product-profiles
/api/brands
/api/product-type-brands
/api/product-templates
/api/products/template
/api/products
/api/units
/api/categories
/api/superadmin/categories
```

Important separation:

```txt
/api/products/template/search  = Template Catalog search from T01
/api/products/pos/search       = Operational Product search for current branch
/api/products/pos/runtime-by-template/:templateProductId = branch operational lookup by template identity
/api/products/pos/create-from-template = temporary/direct create-from-template endpoint
```

### Quick Receive / Stock / Procurement

```txt
/api/quick-stock
/api/quick-receipts
/api/stock-items
/api/stock/dashboard
/api/stock-audit
/api/barcodes
/api/purchase-orders
/api/purchase-order-receipts
/api/purchase-order-receipt-items
/api/receipts/simple
/api/po-receipts/simple
```

### Sales / Online / Finance

```txt
/api/sales
/api/sale-orders      (backward compatibility path)
/api/sale-returns
/api/refunds
/api/payments
/api/supplier-payments
/api/banks
/api/order-online
/api/cart
/api/finance
/api/combined-billing
/api/sales-reports
/api/purchase-reports
/api/input-tax-reports
/api/upload-slips
```

### Branch / Pricing

```txt
/api/branches
/api/branch-prices
```

## 5. Product Runtime Map

### `routes/productRoutes.js`

Responsibility:
- Main production product API route.
- Public online product routes before `verifyToken`.
- Protected POS/runtime product routes after `router.use(verifyToken)`.

Important routes:

```txt
GET  /api/products/online/dropdowns
GET  /api/products/online/search
GET  /api/products/online/detail/:id

GET  /api/products/dropdowns
GET  /api/products/pos/search
GET  /api/products/pos/runtime-by-template/:templateProductId
POST /api/products/pos/create-from-template
GET  /api/products/pos/:id
GET  /api/products/ready-to-sell
GET  /api/products/ready-to-sell/structured/:productId
GET  /api/products
POST /api/products
PATCH /api/products/:id
POST /api/products/:id/disable
POST /api/products/:id/enable
GET  /api/products/:id/delete-check
PATCH /api/products/:id/archive
DELETE /api/products/:id
```

Important note:
- `POST /api/products/pos/create-from-template` currently has route-local handler logic.
- It was added as a blocker-removal endpoint, but Mission B may prefer `/api/quick-stock/existing` as the true end-to-end workflow path.

### `controllers/productController.js`

Responsibility:
- Main legacy production product controller.
- Owns Product List, POS search, Online search, runtime product mapping, product CRUD, archive/delete safety, and some ready-to-sell behavior.

Important doctrine already present:

```txt
Runtime Catalog Separation:
Product List / Online / POS operational catalog must show Operational Product for the branch.
Template Product is reserved for QuickStock search / clone source.
```

Important functions:

```txt
getAllProducts
getProductsForPos
getOperationalProductByTemplateId
getProductsForOnline
mapRuntimeProductForPos
createProduct
updateProduct
disableProduct / enableProduct
archiveProduct / deleteProduct
getProductDeleteCheck
```

### Product runtime behavior

Operational product query usually scopes by:

```txt
product.productType.branchId = current branchId
```

This is the core branch isolation rule.

## 6. Template Product Search Map

### `src/modules/product/routes/templateProductSearchRoutes.js`

Route when mounted:

```txt
GET /api/products/template/search
```

Responsibilities:
- Uses `verifyToken`.
- Uses employee-context guard.
- Delegates to `templateProductSearchController.searchTemplateProducts`.

### `src/modules/product/controllers/templateProductSearchController.js`

Responsibilities:
- Calls `TemplateProductSearchService.searchTemplateProducts(req.query)`.
- Returns both `data` and `items` for FE compatibility.

### `src/modules/product/services/templateProductSearchService.js`

Responsibilities:
- Defaults Template Branch to `T01`.
- Finds Template Branch.
- Applies pagination.
- Calls repository.
- Maps template product into FE runtime template shape.

Important template shape:

```txt
isTemplateProduct: true
templateProductId: product.id
templateBranchId
templateBranchCode
category / productType / brand / unit fields
price snapshot from Template BranchPrice
```

### `src/modules/product/repositories/productTemplateRepository.js`

Responsibilities:
- Prisma-only data access layer for Template Product search.
- Owns `DEFAULT_TEMPLATE_BRANCH_CODE = 'T01'`.
- Finds Template Branch by branch code.
- Builds product where filters.
- Selects product type, global category, brand, unit, image, and branchPrice snapshot.

Repository must not own business workflow decisions.

## 7. Product Template Engine Map

Canonical clone engine:

```txt
src/modules/product/services/productTemplateEngine/
```

### Engine sequence

```txt
validateTemplate
→ findExistingClone
→ cloneProductType
→ cloneBrandMapping
→ cloneProduct
→ cloneImages
→ cloneBranchPrice
→ afterCloneHooks
```

### Key files

```txt
index.js
productCloneService.js
validateTemplate.js
cloneProductType.js
cloneBrandMapping.js
cloneProduct.js
cloneImages.js
cloneBranchPrice.js
afterCloneHooks.js
constants.js
```

### Engine responsibilities

- Validate Template Branch and Template Product.
- Ensure target branch has matching ProductType.
- Copy ProductTypeBrand mapping safely.
- Create Operational Product from Template Product.
- Preserve `templateProductId`.
- Copy images.
- Create default BranchPrice from template.
- Run post-clone hooks.
- Support external transaction for QuickStock / PO / Receive runtime.

### Canonical rule

Use:

```js
const { cloneProductFromTemplate } = require('../../product/services/productTemplateEngine')
```

Avoid creating new clone logic outside this engine.

## 8. QuickStock Runtime Map

### `src/modules/quickStock/routes/quickStockRoutes.js`

Mounted at:

```txt
/api/quick-stock
```

Endpoints:

```txt
POST /api/quick-stock/quick-enroll
POST /api/quick-stock/all-in-one
POST /api/quick-stock/existing
```

Uses:
- `verifyToken`
- Hybrid employee context guard

### `src/modules/quickStock/controllers/quickStockController.js`

Important methods:

```txt
quickStockInAllInOne
quickStockExistingReceive
```

`quickStockExistingReceive` is the main Mission B candidate because it accepts an existing Product id OR Template Product id and lets service auto-clone when needed.

Controller contract requires:

```txt
productId
costPrice
priceRetail
queue via barcodes/items
```

Queue item must not contain pricing fields.

### `src/modules/quickStock/services/QuickStockService.js`

Canonical active QuickStock service.

Important method:

```txt
quickReceiveExistingProduct(data, currentBranchId, employeeId)
```

Runtime flow:

```txt
normalize queue
→ validate duplicate barcode outside transaction
→ validate duplicate serial outside transaction
→ derive runtime price payload from form
→ transaction begin
→ find operational product in current branch
→ if missing, cloneProductFromTemplate(templateProductId, branchId)
→ upsert BranchPrice from runtime form price
→ write stock item or simple lot
→ write stock movement
→ upsert stock balance
→ return productId/productName/qty/trace
```

This is currently the strongest backend path for Mission B end-to-end completion.

### `src/modules/quickStock/services/QuickStockService_Runtime_SafeTransaction.js`

Older safety/reference implementation.

Use as reference only unless assigned.

## 9. BranchPrice Runtime Map

### `routes/branchPriceRoutes.js`

Mounted at:

```txt
/api/branch-prices
```

Protected by `verifyToken`.

Routes:

```txt
GET  /api/branch-prices/me/:productId
POST /api/branch-prices
GET  /api/branch-prices/by-branch
GET  /api/branch-prices/all-products
PUT  /api/branch-prices/bulk-update
GET  /api/branch-prices/profile-by-slug/:slug
```

### `controllers/branchPriceController.js`

Responsibility:
- Reads active BranchPrice for current branch/product.
- Upserts BranchPrice.
- Supports branch scoped price management.

Runtime Branch Price Contract:

```txt
Source of Truth: Quick Receive Runtime Session
Required: productId, costPrice, priceRetail
Optional: priceWholesale, priceTechnician, priceOnline
Queue item must never contain pricing.
```

This matches QuickStock existing receive behavior.

## 10. Auth / Context Map

### Context objects

Current backend has two context styles:

```txt
Legacy: req.user
New/hybrid: req.employee
```

`verifyToken` creates `req.user`.
Some new module guards also check `req.employee`, but `verifyToken.js` currently does not create `req.employee` by itself.

Therefore module guards often support both:

```txt
req.user.role / req.user.profileType / req.user.branchId
req.employee.role / req.employee.branchId
```

Important risk:
- New module code must not assume `req.employee` always exists unless another middleware creates it.
- Prefer fallback pattern:

```js
const branchId = req.employee?.branchId || req.user?.branchId
const employeeId = req.employee?.id || req.user?.employeeId || req.user?.id
```

## 11. Canonical vs Legacy / Duplicate Map

### Canonical for Template Clone

```txt
src/modules/product/services/productTemplateEngine/
```

### Legacy / duplicate clone service

```txt
src/modules/product/services/productCloneService.js
```

Current search shows references to both clone service names. Do not delete legacy clone service until a dedicated dependency verification assignment proves zero runtime dependency.

Safe deletion protocol:

```txt
Identify canonical
→ Search all imports/requires
→ Redirect references one file at a time
→ Verify runtime and tests
→ Confirm zero dependency
→ Delete legacy file
```

## 12. Mission B Current Backend Understanding

Mission B should proceed as workflow verification, not more feature construction.

Current checkpoint status:

```txt
B-01 Template Search                 Ready
B-02 Template Selection              Ready
B-03 Operational Lookup              Ready / FE prepared
B-04 Clone/Create Operational Product Engine exists
B-05 BranchPrice Ready               Clone default + runtime upsert exists
B-06 Stock Intake                    QuickReceive runtime exists
B-07 End-to-End Runtime Verification NEXT
```

## 13. Recommended Next Backend Reads

For broader backend mapping, future Tasks should inspect these next:

```txt
routes/stockRoutes.js
controllers/stockController.js
routes/stockItemRoutes.js
controllers/stockItemController.js
routes/purchaseOrderRoutes.js
controllers/purchaseOrderController.js
routes/purchaseOrderReceiptRoutes.js
controllers/purchaseOrderReceiptController.js
routes/quickReceiptRoutes.js
controllers/quickReceiptController.js
routes/saleRoutes.js
controllers/saleController.js
prisma/schema.prisma
```

## 14. Backend Rules for Future Assignments

Every backend assignment must clearly state:

```txt
Mission
Workflow checkpoint
Runtime path being affected
Legacy files allowed
Module files allowed
Files forbidden
Whether this is feature recovery, verification, or migration
Rollback risk
Verification report path
```

If an assignment does not clearly say whether it is a production-runtime patch or migration patch, the Task must stop and ask ROLE-ARCH.
