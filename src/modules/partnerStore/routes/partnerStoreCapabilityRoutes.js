'use strict'

const express = require('express')
const verifyToken = require('../../../../middlewares/verifyToken')
const controller = require('../controllers/partnerStoreCapabilityController')
const onlineVisibilityController = require('../onlineVisibility/onlineProductVisibilityController')
const onlineProductControlController = require('../onlineProductControl/onlineProductControlController')
const onboardingRoutes = require('../onboarding/partnerStoreOnboardingRoutes')
const operationalReadinessRoutes = require('../readiness/partnerStoreOperationalReadinessRoutes')

const router = express.Router()

const cleanRole = (value) => String(value || '').trim().toUpperCase()
const allowEmployeeContext = (req, res, next) => {
  const legacyRole = cleanRole(req?.user?.role)
  const legacyProfileType = String(req?.user?.profileType || '').trim().toLowerCase()
  const employeeRole = cleanRole(req?.employee?.role)
  const authorized =
    ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(legacyRole) ||
    ['EMPLOYEE', 'ADMIN', 'SUPERADMIN', 'SUPPERADMIN'].includes(employeeRole) ||
    legacyProfileType === 'employee'

  if (authorized) return next()
  return res.status(403).json({
    success: false,
    code: 'FORBIDDEN_PARTNER_STORE_ACCESS',
    message: 'ไม่มีสิทธิ์จัดการการตั้งค่าร้าน',
  })
}

router.use('/onboarding', onboardingRoutes)
router.use('/readiness', operationalReadinessRoutes)
router.use(verifyToken, allowEmployeeContext)
router.get('/capability', controller.getCurrentBranchCapability)
router.put('/capability', controller.saveCurrentBranchCapability)
router.get('/online-products/visibility-audit', onlineVisibilityController.getCurrentBranchAudit)
router.patch('/online-products/:productId/price', onlineProductControlController.updateMarketplacePrice)

module.exports = router
