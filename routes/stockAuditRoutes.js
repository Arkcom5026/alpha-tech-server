

// =============================
// routes/stockAuditRoutes.js
// ✅ ใช้ verifyToken จริง จาก middleware (ไม่มี DEV fallback)

const express = require('express')
const router = express.Router()

const {
  startReadyAudit,
  getOverview,
  scanBarcode,
  scanSn,
  confirmAudit,
  cancelAudit,
  listAuditItems,
} = require('../controllers/stockAuditController')

// ใช้ middleware auth จริง
const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

// Ready-to-Sell Audit
router.post('/ready/start', startReadyAudit)
router.get('/:sessionId/overview', getOverview)
router.post('/:sessionId/scan', scanBarcode)
router.post('/:sessionId/scan-sn', scanSn) // ✅ สแกนด้วย Serial Number
router.post('/:sessionId/confirm', confirmAudit)
router.post('/:sessionId/cancel', cancelAudit) // ✅ ยกเลิกรอบ (Soft-cancel)
router.get('/:sessionId/items', listAuditItems)

module.exports = router

