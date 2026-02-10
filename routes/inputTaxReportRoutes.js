// src/routes/inputTaxReportRoutes.js

const express = require('express');
const router = express.Router();

// 1. นำเข้า Controller ที่เกี่ยวข้อง
const { getInputTaxReport } = require('../controllers/inputTaxReportController');

// 2. นำเข้า Middleware สำหรับตรวจสอบสิทธิ์
const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

// 3. กำหนด Endpoint สำหรับรายงานภาษีซื้อ
// ✅ GET: / (เมื่อรวมกับ prefix ใน server.js จะเป็น /api/input-tax-reports)
router.get('/', getInputTaxReport);

module.exports = router;

