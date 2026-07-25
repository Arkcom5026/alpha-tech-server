# Backend System Map — P1 / alpha-tech-server

Status: ACTIVE BASELINE
Purpose: Give new Tasks a backend boot map before Mission work.

This map is broader than `RUNTIME_MAP.md`.

- `RUNTIME_MAP.md` focuses on Mission B Product Template → Quick Receive → Stock Runtime.
- `SYSTEM_MAP.md` explains the current backend structure, route surface, migration model, and domain boundaries.

## 1. Backend Operating Model

P1 backend is a live production-style system using a mixed architecture while domains migrate independently.

```txt
Legacy / Compatibility Surface
  server.js
  routes/
  controllers/
  middlewares/
  lib/
  prisma/

Module Runtime
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
→ Cut over only after capability coverage
→ Keep every intermediate state deployable
```

A domain may become MODULE-CANONICAL even while the overall backend remains mixed.

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

`productRoutes` remains the server import name for compatibility, but its runtime authority is now the Product module router.

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
/api/products/pos/create-from-template = compatibility/direct create-from-template endpoint
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

### Active route chain

```txt
server.js
→ /api/products
→ routes/productRoutes.js
→ src/modules/product/routes/productModuleRoutes.js
→ Product-owned controllers/services/repositories
```

`routes/productRoutes.js` is a compatibility mount only. It must not regain endpoint logic.

### Product Module Router

Canonical file:

```txt
src/modules/product/routes/productModuleRoutes.js
```

Responsibilities:
- Preserves public online routes before authentication.
- Applies `verifyToken` to protected Product runtime routes.
- Composes Product-owned capability slices.
- Preserves existing external endpoint paths.

Important routes:

```txt
GET    /api/products/online/dropdowns
GET    /api/products/online/search
GET    /api/products/online/detail/:id
GET    /api/products/dropdowns
GET    /api/products/pos/search
GET    /api/products/pos/runtime-by-template/:templateProductId
POST   /api/products/pos/create-local
POST   /api/products/pos/create-from-template
GET    /api/products/pos/:id
GET    /api/products/ready-to-sell
GET    /api/products/ready-to-sell/structured/:productId
GET    /api/products
POST   /api/products
PATCH  /api/products/:id
POST   /api/products/:id/disable
POST   /api/products/:id/enable
GET    /api/products/:id/delete-check
PATCH  /api/products/:id/archive
DELETE /api/products/:id
DELETE /api/products/:id/images
POST   /api/products/:id/migrate-to-simple
GET    /api/products/:productId/prices
PUT    /api/products/:productId/prices
POST   /api/products/:productId/prices
DELETE /api/products/:productId/prices/:priceId
```

### Product capability ownership

```txt
src/modules/product/query/
src/modules/product/create/
src/modules/product/update/
src/modules/product/status/
src/modules/product/delete/
src/modules/product/imageDelete/
src/modules/product/pricing/
src/modules/product/migrateToSimple/
```

Each capability owns its HTTP → Controller → Service → Repository → Prisma path.

### Deprecated legacy Product controller

```txt
controllers/productController.js
```

Status:
- Not imported by the active Product route.
- Not an approved runtime authority.
- Retained only until repository reference verification and dedicated legacy removal complete.

Do not patch or restore this file for new Product behavior.

### Product runtime behavior

Operational Product queries scope by:

```txt
product.productType.branchId = current branchId
```

This is the core branch isolation rule.

Runtime Catalog Separation remains mandatory:

```txt
Product List / Online / POS operational catalog = Operational Product for the branch
Template Product = QuickStock search / clone source
```

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

Engine sequence:

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

Engine responsibilities:
- Validate Template Branch and Template Product.
- Ensure target branch has matching ProductType.
- Copy ProductTypeBrand mapping safely.
- Create Operational Product from Template Product.
- Preserve `templateProductId`.
- Copy images.
- Create default BranchPrice from template.
- Run post-clone hooks.
- Support external transaction for QuickStock / PO / Receive runtime.

Canonical rule:

```js
const { cloneProductFromTemplate } = require('../../product/services/productTemplateEngine')
```

Avoid creating new clone logic outside this engine.

## 8. QuickStock Runtime Map

Canonical active files:

```txt
src/modules/quickStock/routes/quickStockRoutes.js
src/modules/quickStock/controllers/quickStockController.js
src/modules/quickStock/services/QuickStockService.js
```

Main Mission B candidate:

```txt
POST /api/quick-stock/existing
→ quickStockController.quickStockExistingReceive
→ QuickStockService.quickReceiveExistingProduct
→ productTemplateEngine.cloneProductFromTemplate if needed
→ BranchPrice upsert
→ StockItem / SimpleLot
→ StockMovement
→ StockBalance
```

Older safety/reference implementations must not be treated as canonical unless verified.

## 9. BranchPrice Runtime Map

Separate API surface:

```txt
/api/branch-prices
→ routes/branchPriceRoutes.js
→ controllers/branchPriceController.js
```

This does not replace Product-owned `/api/products/:productId/prices` endpoints. The two surfaces must preserve their existing contracts until a dedicated BranchPrice consolidation assignment is approved.

## 10. Migration Authority Rule

Runtime evidence outranks stale documentation.

When verified runtime has completed a cutover:

```txt
Update maps and protection rules
→ prohibit restoration of the old authority
→ perform zero-reference verification
→ remove legacy only in a dedicated commit
```

A historical rule such as “do not delete the Product controller” expires once:
- Module capability coverage is complete.
- Runtime cutover is committed.
- Active route imports are zero.
- Script/test/document dependencies are cleaned.
- Verification evidence is recorded.

Repository Review does not certify local build, runtime, database, or operational behavior.
