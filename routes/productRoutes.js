// server/routes/productRoutes.js
const express = require('express')
const router = express.Router()

const {
  getAllProducts,
  getProductPosById,
  createProduct,
  updateProduct,
  disableProduct,
  enableProduct,
  getProductDropdowns,
  getProductsForOnline,
  getProductOnlineById,
  getProductsForPos,
  migrateSnToSimple,
} = require('../controllers/productController')

const verifyToken = require('../middlewares/verifyToken')

// ✅ Public routes (ไม่ต้อง login)
router.get('/online/search', getProductsForOnline)
router.get('/online/dropdowns', getProductDropdowns)
router.get('/online/detail/:id', getProductOnlineById)

// ✅ POS dropdowns (ต้อง login) — อนุโลม SUPERADMIN แบบ read-only เฉพาะเส้นนี้
// หมายเหตุ: ยังยึด branch scope จาก JWT (req.user.branchId) เสมอ
const allowDropdownsForSuperAdminOrEmployee = (req, res, next) => {
  try {
    const user = req.user || {}

    // ต้องมี branchId เสมอ (branch-scope)
    if (!user.branchId) {
      return res.status(401).json({ message: 'unauthorized' })
    }

    // อนุโลมเฉพาะ SUPERADMIN (แม้ profileType จะเป็น customer)
    if (user.role === 'SUPERADMIN') {
      return next()
    }

    // ผู้ใช้งาน POS ปกติ (employee/admin) ให้ผ่านตามเดิม
    if (user.profileType === 'employee' || user.role === 'ADMIN' || user.role === 'EMPLOYEE') {
      return next()
    }

    return res.status(401).json({ message: 'unauthorized' })
  } catch (_err) {
    return res.status(401).json({ message: 'unauthorized' })
  }
}

router.get('/dropdowns', verifyToken, allowDropdownsForSuperAdminOrEmployee, getProductDropdowns)

// ✅ Protected routes (ต้อง login)
router.use(verifyToken)

router.get('/', getAllProducts)
router.get('/lookup', getProductsForPos)
router.get('/pos/search', getProductsForPos)
router.get('/:id', getProductPosById)

router.post('/', createProduct)
router.put('/:id', updateProduct)
router.patch('/:id', updateProduct)

router.post('/:id/migrate-to-simple', migrateSnToSimple)
router.post('/pos/migrate-to-simple/:id', migrateSnToSimple)

router.post('/:id/disable', disableProduct)
router.post('/:id/enable', enableProduct)
router.delete('/:id', disableProduct)

// upload routes
const uploadProductRoutes = require('./uploadProductRoutes')
router.use('/', uploadProductRoutes)

module.exports = router

