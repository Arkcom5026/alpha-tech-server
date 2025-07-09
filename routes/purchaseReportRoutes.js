const express = require('express');
const router = express.Router();
const { getPurchaseReport } = require('../controllers/purchaseReportController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ GET: รายงานการจัดซื้อ
router.get('/', getPurchaseReport);

module.exports = router;
