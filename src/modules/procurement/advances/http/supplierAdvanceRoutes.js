'use strict';

const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const controller = require('./supplierAdvanceController');
const {
  requireSupplierAdvanceRead,
  requireSupplierAdvanceManage,
  requireSupplierAdvanceControl,
} = require('./supplierAdvanceAuthorization');

const router = express.Router();
router.use(verifyToken);

router.get('/', requireSupplierAdvanceRead, controller.list);
router.post('/', requireSupplierAdvanceManage, controller.create);
router.post('/:advanceId/apply', requireSupplierAdvanceManage, controller.apply);
router.post('/:advanceId/activate', requireSupplierAdvanceControl, controller.activateLegacy);
router.post('/:advanceId/void', requireSupplierAdvanceControl, controller.voidAdvance);

module.exports = router;
