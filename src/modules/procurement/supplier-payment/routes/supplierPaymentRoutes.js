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

const router = express.Router();
router.use(verifyToken);

router.post('/', requireSupplierPaymentActor, (req, res) =>
  res.status(409).json({
    code: 'SUPPLIER_PAYMENT_AUTHORITY_REQUIRED',
    message: 'การชำระและเงินจ่ายล่วงหน้า Supplier ต้องดำเนินการผ่าน authority ใหม่',
  })
);

router.get('/advance', getAdvancePaymentsBySupplier);
router.get('/by-supplier/:supplierId', getSupplierPaymentsBySupplier);
router.get('/', getAllSupplierPayments);
router.get('/by-po/:poId', getSupplierPaymentsByPO);
router.delete('/:id', (req, res) =>
  res.status(409).json({
    code: 'SUPPLIER_PAYMENT_REVERSAL_REQUIRED',
    message: 'รายการชำระเงินห้ามลบ กรุณาใช้กระบวนการยกเลิกเพื่อรักษาประวัติ',
  })
);

module.exports = router;
