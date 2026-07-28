'use strict';

const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const controller = require('./supplierAdvanceController');

const router = express.Router();
router.use(verifyToken);
const roles = (req) => [
  req.user?.role, req.user?.employeeRole, req.user?.v2Role, req.user?.position,
].map((value) => String(value || '').trim().toUpperCase());
const allowed = (req, accepted) => roles(req).some((value) => accepted.includes(value));
router.use((req, res, next) => allowed(req, ['SUPERADMIN', 'ADMIN', 'OWNER', 'MANAGER'])
  ? next()
  : res.status(403).json({
    code: 'SUPPLIER_ADVANCE_ACCESS_FORBIDDEN',
    message: 'เงินจ่ายล่วงหน้า Supplier ต้องใช้สิทธิ์ OWNER หรือ MANAGER',
  }));

router.get('/', controller.list);
router.post('/', controller.create);
router.post('/:advanceId/apply', controller.apply);
router.post('/:advanceId/activate', (req, res, next) => (
  allowed(req, ['SUPERADMIN', 'ADMIN', 'OWNER'])
    ? controller.activateLegacy(req, res, next)
    : res.status(403).json({
      code: 'SUPPLIER_ADVANCE_ACTIVATE_FORBIDDEN',
      message: 'การรับรองยอด Advance เดิมต้องใช้สิทธิ์ OWNER',
    })
));
router.post('/:advanceId/void', (req, res, next) => (
  allowed(req, ['SUPERADMIN', 'ADMIN', 'OWNER'])
    ? controller.voidAdvance(req, res, next)
    : res.status(403).json({
      code: 'SUPPLIER_ADVANCE_VOID_FORBIDDEN',
      message: 'การยกเลิก Advance ต้องใช้สิทธิ์ OWNER',
    })
));

module.exports = router;
