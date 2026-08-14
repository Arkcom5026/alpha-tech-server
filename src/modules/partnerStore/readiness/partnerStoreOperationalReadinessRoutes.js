'use strict'

const express = require('express')
const verifyToken = require('../../../../middlewares/verifyToken')
const service = require('./partnerStoreOperationalReadinessService')

const router = express.Router()

router.use(verifyToken)

router.get('/me', async (req, res, next) => {
  try {
    const data = await service.getOperationalReadiness(req.user?.id)
    return res.json({ success: true, data })
  } catch (error) {
    return next(error)
  }
})

router.post('/certify', async (req, res, next) => {
  try {
    const data = await service.certifyOperationalReadiness(req.user?.id)
    return res.json({ success: true, data })
  } catch (error) {
    return next(error)
  }
})

module.exports = router
