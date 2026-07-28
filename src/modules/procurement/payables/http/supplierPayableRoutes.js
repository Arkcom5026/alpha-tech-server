'use strict';

const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const controller = require('./supplierPayableController');

const router = express.Router();
router.use(verifyToken);

router.use((req, res, next) => {
  const accountRole = String(req.user?.role || '').trim().toUpperCase();
  const employeeRole = String(
    req.user?.employeeRole || req.user?.v2Role || req.user?.position || '',
  ).trim().toUpperCase();
  if (['SUPERADMIN', 'ADMIN'].includes(accountRole) || ['OWNER', 'MANAGER'].includes(employeeRole)) {
    return next();
  }
  return res.status(403).json({
    code: 'SUPPLIER_PAYABLE_ACCESS_FORBIDDEN',
    message: 'รายการเจ้าหนี้ต้องใช้สิทธิ์ OWNER หรือ MANAGER',
  });
});

router.get('/candidates', controller.listCandidates);
router.get('/', controller.list);
router.post('/from-receipts', controller.createFromReceipts);

module.exports = router;
