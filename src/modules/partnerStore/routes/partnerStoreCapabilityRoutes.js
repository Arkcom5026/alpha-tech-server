'use strict'

const express = require('express')
const verifyToken = require('../../../../middlewares/verifyToken')
const controller = require('../controllers/partnerStoreCapabilityController')
const onlineVisibilityController = require('../onlineVisibility/onlineProductVisibilityController')
const onlineProductControlController = require('../onlineProductControl/onlineProductControlController')
const onboardingRoutes = require('../onboarding/partnerStoreOnboardingRoutes')
const operationalReadinessRoutes = require('../readiness/partnerStoreOperationalReadinessRoutes')
const {
  PARTNER_STORE_CAPABILITY,
  requirePartnerStoreEmployeeContext,
  allowPartnerStoreCapabilities,
} = require('../authorization/partnerStorePositionAuthorization')

const router = express.Router()
const canReadStoreExperience = allowPartnerStoreCapabilities(PARTNER_STORE_CAPABILITY.READ)
const canManageStoreExperience = allowPartnerStoreCapabilities(
  PARTNER_STORE_CAPABILITY.READ,
  PARTNER_STORE_CAPABILITY.MANAGE,
)

router.use('/onboarding', onboardingRoutes)
router.use('/readiness', operationalReadinessRoutes)
router.use(verifyToken, requirePartnerStoreEmployeeContext)
router.get('/capability', canReadStoreExperience, controller.getCurrentBranchCapability)
router.put('/capability', canManageStoreExperience, controller.saveCurrentBranchCapability)
router.get('/online-products/visibility-audit', canReadStoreExperience, onlineVisibilityController.getCurrentBranchAudit)
router.patch('/online-products/:productId/price', canManageStoreExperience, onlineProductControlController.updateMarketplacePrice)

module.exports = router
