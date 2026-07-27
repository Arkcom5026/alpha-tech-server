// ✅ stockRoutes.js — Inventory dashboard compatibility routes

const express = require('express');
const router = express.Router();

const overviewController = require('../src/modules/inventory/dashboard/query/overview/getStockDashboardOverviewSlice');
const auditInProgressController = require('../src/modules/inventory/dashboard/query/audit-in-progress/getStockDashboardAuditInProgressSlice');
const riskController = require('../src/modules/inventory/dashboard/query/risk/getStockDashboardRiskSlice');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

router.get('/overview', overviewController.handle);
router.get('/audit-in-progress', auditInProgressController.handle);
router.get('/risk', riskController.handle);

module.exports = router;
