




// ============================================================
// 📁 FILE: routes/productRoutes.js
// ✅ Production-grade routing with clear public vs protected scopes
// ✅ Fix route ordering to avoid swallowing '/online/*'
// ✅ Wires ALL product-related endpoints referenced by FE productApi.js
// Base mount: app.use('/api/products', productRoutes)
// ============================================================

const express = require('express')
const router = express.Router()

const productController = require('../controllers/productController')

// ✅ Auth (Single Source of Truth)
// ตามมาตรฐานโปรเจกต์นี้: ใช้ verifyToken เป็น middleware กลาง
const verifyToken = require('../middlewares/verifyToken')

// ------------------------------------------------------------
// ✅ PUBLIC: ONLINE SHOP (no auth)
// Final paths:
//   GET /api/products/online/dropdowns
//   GET /api/products/online/search
//   GET /api/products/online/detail/:id
// ------------------------------------------------------------
router.get('/online/dropdowns', productController.getProductDropdowns)
router.get('/online/search', productController.getProductsForOnline)
router.get('/online/detail/:id', productController.getProductOnlineById)

// ------------------------------------------------------------
// 🔒 PROTECTED: POS / Backoffice (require auth)
// ------------------------------------------------------------
router.use(verifyToken)

// --- Dropdowns (auth) ---
// NOTE: FE Online uses /online/dropdowns (public)
router.get('/dropdowns', productController.getProductDropdowns)

// --- POS search / detail ---
router.get('/pos/search', productController.getProductsForPos)
router.get('/pos/:id', productController.getProductPosById)

// --- Ready-to-sell (branch-scoped) ---
// IMPORTANT: must be declared BEFORE any '/:id' route, otherwise 'ready-to-sell' will be treated as an id
// Final path:
//   GET /api/products/ready-to-sell?branchId=2&mode=ALL&page=1&pageSize=25&sort=receivedAt_desc
if (typeof productController.getReadyToSell === 'function') {
  router.get(
    '/ready-to-sell',
    (req, _res, next) => {
      try {
        // ✅ Best-effort trace (DEV only)
        if (process.env.NODE_ENV !== 'production') {
          console.log('[route] GET /api/products/ready-to-sell', {
            reqId: req?.id || req?.reqId || req?.headers?.['x-request-id'] || null,
            userId: req?.user?.id || null,
            branchId: req?.query?.branchId || null,
            mode: req?.query?.mode || null,
            page: req?.query?.page || null,
            pageSize: req?.query?.pageSize || null,
            sort: req?.query?.sort || null,
          })
        }
      } catch (_e) {
        // ignore
      }
      next()
    },
    productController.getReadyToSell
  )
} else {
  // ✅ Soft guard: clear 501 instead of being swallowed by '/:id'
  router.get('/ready-to-sell', (_req, res) => res.status(501).json({ ok: false, error: 'NOT_IMPLEMENTED_READY_TO_SELL' }))
}


// --- Ready-to-sell (STRUCTURED details) ---
// IMPORTANT: must be declared BEFORE any '/:id' route, otherwise it may be swallowed.
// Final path:
//   GET /api/products/ready-to-sell/structured/:productId?q=
if (typeof productController.getReadyToSellStructuredDetails === 'function') {
  router.get('/ready-to-sell/structured/:productId', productController.getReadyToSellStructuredDetails)
} else {
  router.get('/ready-to-sell/structured/:productId', (_req, res) => res.status(501).json({ ok: false, error: 'NOT_IMPLEMENTED_READY_TO_SELL_DETAILS' }))
}

// --- Admin list / CRUD ---
router.get('/', productController.getAllProducts)
router.post('/', productController.createProduct)
router.patch('/:id', productController.updateProduct)

// Legacy enable/disable (policy: blocked by controller)
router.post('/:id/disable', productController.disableProduct)
router.post('/:id/enable', productController.enableProduct)

// ✅ SuperAdmin destructive actions (production-grade)
// - delete-check: ตรวจสอบว่าลบจริงได้ไหม (usage counts)
// - archive: ซ่อน/ปิดสินค้าแบบไม่ทำลายประวัติ (active=false)
router.get('/:id/delete-check', productController.getProductDeleteCheck)
router.patch('/:id/archive', productController.archiveProduct)

// ✅ Alias: FE legacy/detail uses GET /api/products/:id?v=full
// - Reuse POS detail handler (branch scope enforced by controller)
router.get('/:id', productController.getProductPosById)

// Delete (SUPERADMIN only) — hard delete (allowed only when no usage)
router.delete('/:id', productController.deleteProduct)

// --- Images (optional) ---
// NOTE: Not used by current FE snippet, but production-safe to expose
router.delete('/:id/images', productController.deleteProductImage)

// --- Migration ops tool ---
router.post('/:id/migrate-to-simple', productController.migrateSnToSimple)

// ------------------------------------------------------------
// ✅ Product Prices (optional module)
// FE expects:
//   GET    /api/products/:productId/prices
//   PUT    /api/products/:productId/prices
//   POST   /api/products/:productId/prices
//   DELETE /api/products/:productId/prices/:priceId
// If your project has a dedicated controller, we wire it automatically.
// ------------------------------------------------------------
let productPriceController = null
try {
  // Prefer explicit controller if you have it
  productPriceController = require('../controllers/productPriceController')
} catch (_e) {
  productPriceController = null
}

if (productPriceController) {
  router.get('/:productId/prices', productPriceController.getProductPrices)
  router.put('/:productId/prices', productPriceController.updateProductPrices)
  router.post('/:productId/prices', productPriceController.addProductPrice)
  router.delete('/:productId/prices/:priceId', productPriceController.deleteProductPrice)
} else {
  // Soft guard: return clear 501 instead of 404 (easier to debug)
  const notImplemented = (_req, res) => res.status(501).json({ ok: false, error: 'NOT_IMPLEMENTED' })
  router.get('/:productId/prices', notImplemented)
  router.put('/:productId/prices', notImplemented)
  router.post('/:productId/prices', notImplemented)
  router.delete('/:productId/prices/:priceId', notImplemented)
}

module.exports = router








