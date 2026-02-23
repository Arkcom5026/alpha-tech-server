

// routes/brandRoutes.js
const express = require('express')
const router = express.Router()

const {
  listBrands,
  createBrand,
  updateBrand,
  toggleBrand,
} = require('../controllers/brandController')

// รองรับทั้ง 2 แบบ:
// 1) module.exports = function (...) {}
// 2) module.exports = { verifyToken: function (...) {} }
const vt = require('../middlewares/verifyToken')
const verifyToken = typeof vt === 'function' ? vt : vt.verifyToken

const ra = require('../middlewares/requireAdmin')
const requireAdmin = typeof ra === 'function' ? ra : ra.requireAdmin

// กันพังตั้งแต่ boot (ถ้า import ผิดจะรู้ทันที)
if (typeof verifyToken !== 'function') {
  throw new Error('[brandRoutes] verifyToken is not a function — check middlewares/verifyToken export')
}
if (typeof requireAdmin !== 'function') {
  throw new Error('[brandRoutes] requireAdmin is not a function — check middlewares/requireAdmin export')
}
if (typeof listBrands !== 'function') {
  throw new Error('[brandRoutes] listBrands is not a function — check controllers/brandController export')
}
if (typeof createBrand !== 'function') {
  throw new Error('[brandRoutes] createBrand is not a function — check controllers/brandController export')
}
if (typeof updateBrand !== 'function') {
  throw new Error('[brandRoutes] updateBrand is not a function — check controllers/brandController export')
}
if (typeof toggleBrand !== 'function') {
  throw new Error('[brandRoutes] toggleBrand is not a function — check controllers/brandController export')
}

// ✅ server.js mount แล้วที่: app.use('/api/brands', brandRoutes)

// ===== Dropdowns (ใช้ใน Product Create / Filter)
// ใช้แค่ verifyToken พอ (employee/admin ใช้ได้)
router.get('/dropdowns', verifyToken, listBrands)

// ✅ READ (Brand เป็นข้อมูลกลาง → employee/admin/superadmin อ่านได้)
const normalizeRole = (r) => String(r || '').trim().toLowerCase()
const normalizeProfileType = (t) => String(t || '').trim().toLowerCase()

const allowReadBrandsForEmployeeContext = (req, res, next) => {
  const role = normalizeRole(req?.user?.role)
  const profileType = normalizeProfileType(req?.user?.profileType)
  const effectiveRole = normalizeRole(req?.user?.effectiveRole)
  const effectiveProfileType = normalizeProfileType(req?.user?.effectiveProfileType)

  const r = effectiveRole || role
  const pt = effectiveProfileType || profileType

  if (['employee', 'admin', 'superadmin'].includes(r)) return next()
  if (pt === 'employee') return next()

  return res.status(403).json({ error: 'FORBIDDEN' })
}

router.get('/', verifyToken, allowReadBrandsForEmployeeContext, listBrands)
router.post('/', verifyToken, requireAdmin, createBrand)
router.put('/:id', verifyToken, requireAdmin, updateBrand)
router.patch('/:id/toggle', verifyToken, requireAdmin, toggleBrand)

module.exports = router




