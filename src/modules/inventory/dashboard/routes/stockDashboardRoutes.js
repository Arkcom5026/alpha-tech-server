'use strict'

const express = require('express')

const verifyToken = require('../../../../../middlewares/verifyToken')
const overviewController = require('../query/overview/getStockDashboardOverviewSlice')
const auditInProgressController = require('../query/audit-in-progress/getStockDashboardAuditInProgressSlice')
const riskController = require('../query/risk/getStockDashboardRiskSlice')

const router = express.Router()

router.use(verifyToken)

router.get('/overview', overviewController.handle)
router.get('/audit-in-progress', auditInProgressController.handle)
router.get('/risk', riskController.handle)

module.exports = router
