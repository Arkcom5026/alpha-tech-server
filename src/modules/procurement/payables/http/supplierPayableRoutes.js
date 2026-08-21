'use strict';

const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const controller = require('./supplierPayableController');
const agingController = require('../query/aging/supplierPayableAgingController');
const disputeController = require('../disputes/supplierPayableDisputeController');
const {
  SUPPLIER_PAYABLE_CAPABILITY,
  allowSupplierPayableCapabilities,
} = require('./supplierPayableAuthorization');

const router = express.Router();
const allowRead = allowSupplierPayableCapabilities(SUPPLIER_PAYABLE_CAPABILITY.READ);
const allowManage = allowSupplierPayableCapabilities(
  SUPPLIER_PAYABLE_CAPABILITY.READ,
  SUPPLIER_PAYABLE_CAPABILITY.MANAGE,
);
const allowControl = allowSupplierPayableCapabilities(
  SUPPLIER_PAYABLE_CAPABILITY.READ,
  SUPPLIER_PAYABLE_CAPABILITY.MANAGE,
  SUPPLIER_PAYABLE_CAPABILITY.CONTROL,
);

router.use(verifyToken);
router.get('/candidates', allowRead, controller.listCandidates);
router.get('/aging', allowRead, agingController.list);
router.get('/disputes', allowRead, disputeController.list);
router.get('/', allowRead, controller.list);
router.post('/from-receipts', allowManage, controller.createFromReceipts);
router.post('/:payableId/disputes', allowManage, disputeController.open);
router.post('/:payableId/adjustments', allowManage, disputeController.createAdjustment);
router.post('/disputes/:disputeId/resolve', allowManage, disputeController.resolve);
router.post('/adjustments/:adjustmentId/void', allowControl, disputeController.voidAdjustment);

module.exports = router;
