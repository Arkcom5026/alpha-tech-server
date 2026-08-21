'use strict';

const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const controller = require('./supplierPaymentAllocationController');
const {
  requireSupplierPaymentManage,
  requireSupplierPaymentVoid,
} = require('../shared/supplierPaymentAllocationAuthorization');

const router = express.Router();
router.use(verifyToken);
router.use(requireSupplierPaymentManage);

router.get('/', controller.list);
router.post('/', controller.createConfirmed);
router.post(
  '/:paymentId/void',
  requireSupplierPaymentVoid,
  controller.voidConfirmed,
);

module.exports = router;
