// src/modules/inventory/routes/inventoryRoutes.js
const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const tenantContext = require('../../../middlewares/tenantContext');
const { protect, restrictTo } = require('../../../middlewares/authGuard');

router.get('/:tenant_slug/inventory/catalog', tenantContext, inventoryController.getOnlineCatalog);

router.post(
  '/:tenant_slug/inventory/audit',
  tenantContext,
  protect,
  restrictTo('MANAGER', 'OWNER'),
  inventoryController.runStockAudit
);

module.exports = router;