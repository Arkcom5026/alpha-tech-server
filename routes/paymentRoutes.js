// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();

const {
  createPayments,
  searchPrintablePayments,
  cancelPayment,
} = require('../controllers/paymentController');
const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

router.post('/', createPayments);
router.get('/printable', searchPrintablePayments);     // ✅ แสดงรายการใบเสร็จย้อนหลัง
router.post('/cancel', cancelPayment);                 // ✅ ยกเลิกรายการชำระเงิน

module.exports = router;
