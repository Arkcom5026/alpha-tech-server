// src/modules/product/routes/templateProductSearchRoutes.js
const express = require('express')
const router = express.Router()

const verifyToken = require('../../../../middlewares/verifyToken')
const templateProductSearchController = require('../controllers/templateProductSearchController')

const cleanRole = (r) => String(r || '').trim().toUpperCase()

const allowEmployeeContext = (req, res, next) => {
  const legacyRole = cleanRole(req?.user?.role)
  const legacyProfileType = String(req?.user?.profileType || '').trim().toLowerCase()
  const newRole = cleanRole(req?.employee?.role)

  const allowed =
    ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(legacyRole) ||
    ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(newRole) ||
    legacyProfileType === 'employee'

  if (allowed) return next()

  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_TEMPLATE_PRODUCT_SEARCH',
    message: 'ไม่มีสิทธิ์ค้นหา Product Template',
  })
}

// Mount suggestion:
// app.use('/api/products/template', templateProductSearchRoutes)
//
// Endpoint:
// GET /api/products/template/search
router.get(
  '/search',
  verifyToken,
  allowEmployeeContext,
  templateProductSearchController.searchTemplateProducts
)

module.exports = router
