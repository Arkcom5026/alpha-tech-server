'use strict';

const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const controller = require('./supplierPaymentAllocationController');

const router = express.Router();
router.use(verifyToken);

const roles = (req) => [
  req.user?.role,
  req.user?.employeeRole,
  req.user?.v2Role,
  req.user?.position,
].map((value) => String(value || '').trim().toUpperCase());
const canManage = (req) => roles(req).some((value) => (
  ['SUPERADMIN', 'ADMIN', 'OWNER', 'MANAGER'].includes(value)
));
const canVoid = (req) => roles(req).some((value) => (
  ['SUPERADMIN', 'ADMIN', 'OWNER'].includes(value)
));

router.use((req, res, next) => canManage(req) ? next() : res.status(403).json({
  code: 'SUPPLIER_PAYMENT_ACCESS_FORBIDDEN',
  message: 'การชำระ Supplier ต้องใช้สิทธิ์ OWNER หรือ MANAGER',
}));
router.get('/', controller.list);
router.post('/', controller.createConfirmed);
router.post('/:paymentId/void', (req, res, next) => {
  if (!canVoid(req)) {
    return res.status(403).json({
      code: 'SUPPLIER_PAYMENT_VOID_FORBIDDEN',
      message: 'การยกเลิกรายการชำระต้องใช้สิทธิ์ OWNER',
    });
  }
  return controller.voidConfirmed(req, res, next);
});

module.exports = router;
