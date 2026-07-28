'use strict';

const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const controller = require('./supplierPayableController');
const agingController = require('../query/aging/supplierPayableAgingController');
const disputeController = require('../disputes/supplierPayableDisputeController');

const router = express.Router();
router.use(verifyToken);
const roles = (req) => [
  req.user?.role, req.user?.employeeRole, req.user?.v2Role, req.user?.position,
].map((value) => String(value || '').trim().toUpperCase());
const ownerOnly = (req, res, next) => roles(req).some((role) => ['SUPERADMIN', 'ADMIN', 'OWNER'].includes(role))
  ? next()
  : res.status(403).json({
    code: 'SUPPLIER_ADJUSTMENT_VOID_FORBIDDEN',
    message: 'การย้อนรายการปรับยอดต้องใช้สิทธิ์ OWNER',
  });

router.use((req, res, next) => {
  if (roles(req).some((role) => ['SUPERADMIN', 'ADMIN', 'OWNER', 'MANAGER'].includes(role))) {
    return next();
  }
  return res.status(403).json({
    code: 'SUPPLIER_PAYABLE_ACCESS_FORBIDDEN',
    message: 'รายการเจ้าหนี้ต้องใช้สิทธิ์ OWNER หรือ MANAGER',
  });
});

router.get('/candidates', controller.listCandidates);
router.get('/aging', agingController.list);
router.get('/disputes', disputeController.list);
router.get('/', controller.list);
router.post('/from-receipts', controller.createFromReceipts);
router.post('/:payableId/disputes', disputeController.open);
router.post('/:payableId/adjustments', disputeController.createAdjustment);
router.post('/disputes/:disputeId/resolve', disputeController.resolve);
router.post('/adjustments/:adjustmentId/void', ownerOnly, disputeController.voidAdjustment);

module.exports = router;
