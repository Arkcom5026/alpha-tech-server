// src/modules/sales/routes/salesRoutes.js
const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const tenantContext = require('../../../middlewares/tenantContext');
const { protect, restrictTo } = require('../../../middlewares/authGuard');

router.post(
  '/:tenant_slug/sales/checkout',
  tenantContext,
  protect,
  restrictTo('CASHIER', 'MANAGER', 'OWNER'),
  salesController.handleCheckout
);

module.exports = router;