const express = require('express');
const router = express.Router();
const path = require('path');
const {
  createSupplierPayment,
  getAllSupplierPayments,
  getSupplierPaymentsByPO,
  deleteSupplierPayment,
  getAdvancePaymentsBySupplier,
  getSupplierPaymentsBySupplier,
} = require('../controllers/supplierPaymentController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ สร้างรายการชำระเงินใหม่
router.post('/', createSupplierPayment);

router.get('/advance', getAdvancePaymentsBySupplier);

// ✅ ดูรายการชำระเงินทั้งหมดของ Supplier รายใดรายหนึ่ง
router.get('/by-supplier/:supplierId', getSupplierPaymentsBySupplier);

// ✅ ดูรายการชำระเงินทั้งหมด
router.get('/', getAllSupplierPayments);

// ✅ ดูการชำระของ PO เดียว
router.get('/by-po/:poId', getSupplierPaymentsByPO);

// ✅ ลบรายการชำระเงิน
router.delete('/:id', deleteSupplierPayment);



module.exports = router;



