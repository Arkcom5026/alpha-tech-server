// routes/simpleStockRoutes.js
const express = require('express');
const router = express.Router();

// ✅ แยก Controllers ชัดเจน
const {
  createSimpleReceipt,
  createSimpleSale,
  createSimpleAdjustment,
} = require('../controllers/simpleStockController');

// ✅ ใช้ middleware เดียวกับไฟล์เดิม
const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// รับเข้า (SIMPLE, แบบจำนวน ไม่ใช้ SN)
router.post('/receipts', createSimpleReceipt);

// ขาย (SIMPLE)
router.post('/sales', createSimpleSale);

// ปรับยอดสต๊อก (บวก/ลบ พร้อมเหตุผล)
router.post('/adjustments', createSimpleAdjustment);

module.exports = router;
