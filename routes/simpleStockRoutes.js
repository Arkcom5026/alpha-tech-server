// routes/simpleStockRoutes.js
const express = require('express');
const router = express.Router();

// ✅ แยก Controllers ชัดเจน
const {
  pingSimple,
  createSimpleReceipt,
  createSimpleSale,
  createSimpleAdjustment,
} = require('../controllers/simpleStockController');

// ✅ ใช้ middleware เดียวกับไฟล์เดิม
const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// Healthcheck / smoke test (auth + branch scope + headers)
router.get('/ping', pingSimple);

// Health / Ping (ตรวจสอบ route + auth + branch scope)
router.get('/ping', pingSimple);

// รับเข้า (SIMPLE, แบบจำนวน ไม่ใช้ SN)
router.post('/receipts', createSimpleReceipt);

// ขาย (SIMPLE)
router.post('/sales', createSimpleSale);

// ปรับยอดสต๊อก (บวก/ลบ พร้อมเหตุผล)
router.post('/adjustments', createSimpleAdjustment);

module.exports = router;


