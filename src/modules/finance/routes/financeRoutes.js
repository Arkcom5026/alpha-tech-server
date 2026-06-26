// src/modules/finance/routes/financeRoutes.js
const express = require('express');
const router = express.Router();
const financeController = require('../controllers/financeController');
const tenantContext = require('../../../middlewares/tenantContext');
const { protect, restrictTo } = require('../../../middlewares/authGuard');

router.get(
  '/:tenant_slug/finance/tax-report',
  tenantContext,
  protect,
  restrictTo('MANAGER', 'OWNER'),
  financeController.getTaxReport
);

router.post(
  '/:tenant_slug/finance/deposit',
  tenantContext,
  protect,
  restrictTo('CASHIER', 'MANAGER', 'OWNER'),
  financeController.handleDeposit
);

module.exports = router;