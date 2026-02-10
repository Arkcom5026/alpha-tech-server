// BE: routes/quickReceiptRoutes.js
// เส้นทาง Quick Receive (Hybrid A) — Draft ก่อน → Finalize
// ยึดรูปแบบเดียวกับ paymentRoutes: ใช้ verifyToken ที่ระดับ router

const express = require('express');
const router = express.Router();

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

const {
  ensureDraft,
  saveItemDraft,
  deleteItemDraft,
  finalize,
} = require('../controllers/quickReceiptController');

// POST /api/quick-receipts (สร้างใบร่าง)
router.post('/', ensureDraft);

// POST /api/quick-receipts/:id/items (บันทึก/อัปเดตรายการแบบ Draft)
router.post('/:id/items', saveItemDraft);

// DELETE /api/quick-receipts/:id/items/:itemId (ลบรายการ Draft)
router.delete('/:id/items/:itemId', deleteItemDraft);

// POST /api/quick-receipts/:id/finalize (Finalize → คอมมิตสต๊อก)
router.post('/:id/finalize', finalize);

module.exports = router;

