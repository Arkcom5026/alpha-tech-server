// =============================
// routes/stockAuditRoutes.js
// ✅ ใช้ verifyToken จริง จาก middleware (ไม่มี DEV fallback)

const express = require('express')
const router = express.Router()

const {
  startReadyAudit,
  getOverview,
  scanBarcode,
  confirmAudit,
  listAuditItems,
} = require('../controllers/stockAuditController')

// ใช้ middleware auth จริง
const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// Ready-to-Sell Audit
router.post('/ready/start', startReadyAudit)
router.get('/:sessionId/overview', getOverview)
router.post('/:sessionId/scan', scanBarcode)
router.post('/:sessionId/confirm', confirmAudit)
router.get('/:sessionId/items', listAuditItems)

module.exports = router
