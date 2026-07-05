// src/modules/product/create/routes/productCreateRoutes.js

const express = require('express')

const verifyToken = require('../../../../../middlewares/verifyToken')
const productCreateController = require('../controllers/productCreateController')

const router = express.Router()

const cleanRole = (role) => String(role || '').trim().toUpperCase()

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
    code: 'FORBIDDEN_PRODUCT_CREATE_RUNTIME',
    message: 'ไม่มีสิทธิ์ใช้งาน Product Create Runtime',
  })
}

router.use(verifyToken)
router.use(allowEmployeeContext)

router.get('/dropdowns', productCreateController.getDropdowns)
router.get('/brands', productCreateController.getBrands)
router.get('/existing-models', productCreateController.getExistingModels)
router.post('/create-local', productCreateController.createLocalProduct)
router.post('/local', productCreateController.createLocalProduct)

module.exports = router
