'use strict'

const express = require('express')
const verifyToken = require('../../../../middlewares/verifyToken')
const service = require('./partnerStoreOnboardingService')

const router = express.Router()
router.use(verifyToken)

router.get('/me', async (req, res, next) => {
  try {
    const data = await service.getOrStartOnboarding(req.user?.id)
    res.json({ ok: true, data })
  } catch (error) {
    next(error)
  }
})

router.post('/complete', async (req, res, next) => {
  try {
    const data = await service.completeOnboarding(req.user?.id, req.body || {})
    res.json({ ok: true, data })
  } catch (error) {
    next(error)
  }
})

module.exports = router
