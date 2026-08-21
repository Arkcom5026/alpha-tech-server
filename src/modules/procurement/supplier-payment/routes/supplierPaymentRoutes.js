const express = require('express');
const verifyToken = require('../../../../../middlewares/verifyToken');
const {
  getAllSupplierPayments,
} = require('../query/list/getAllSupplierPaymentsController');
const {
  getSupplierPaymentsByPO,
} = require('../query/by-po/getSupplierPaymentsByPOController');
const {
  getAdvancePaymentsBySupplier,
} = require('../query/advance/getAdvancePaymentsBySupplierController');
const {
  getSupplierPaymentsBySupplier,
} = require('../query/by-supplier/getSupplierPaymentsBySupplierController');
const {
  requireSupplierPaymentActor,
} = require('../shared/requireSupplierPaymentActor');
const {
  SUPPLIER_PAYMENT_CAPABILITY,
  allowSupplierPaymentCapabilities,
} = require('../shared/supplierPaymentAuthorization');

const router = express.Router();
router.use(verifyToken);

const allowSupplierPaymentRead = allowSupplierPaymentCapabilities(
  SUPPLIER_PAYMENT_CAPABILITY.READ,
);

router.post('/', requireSupplierPaymentActor, (req, res) =>
  res.status(409).json({
    code: 'SUPPLIER_PAYMENT_AUTHORITY_REQUIRED',
    message: 'การชำระและเงินจ่ายล่วงหน้า Supplier ต้องดำเนินการผ่าน authority ใหม่',
  })
);

router.get('/advance', allowSupplierPaymentRead, getAdvancePaymentsBySupplier);
router.get('/by-supplier/:supplierId', allowSupplierPaymentRead, getSupplierPaymentsBySupplier);
router.get('/', allowSupplierPaymentRead, getAllSupplierPayments);
router.get('/by-po/:poId', allowSupplierPaymentRead, getSupplierPaymentsByPO);
router.delete('/:id', (req, res) =>
  res.status(409).json({
    code: 'SUPPLIER_PAYMENT_REVERSAL_REQUIRED',
    message: 'รายการชำระเงินห้ามลบ กรุณาใช้กระบวนการยกเลิกเพื่อรักษาประวัติ',
  })
);

module.exports = router;
