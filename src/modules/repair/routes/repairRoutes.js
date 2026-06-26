// src/modules/repair/routes/repairRoutes.js

const express = require('express');
const router = express.Router();
const repairController = require('../controllers/repairController');

// 🟢 ปรับตรงนี้: ถอย 3 ชั้นเข้าสู่ src/ เข้าโฟลเดอร์ middlewares แล้วเรียก authGuard
const { protect, restrictTo } = require('../../../middlewares/authGuard'); 

router.use(protect);

router.post('/jobs', restrictTo('MANAGER', 'CASHIER', 'TECHNICIAN'), repairController.createJob);
router.patch('/jobs/:id/status', restrictTo('MANAGER', 'TECHNICIAN'), repairController.updateStatus);
router.post('/jobs/:id/parts', restrictTo('MANAGER', 'TECHNICIAN'), repairController.addParts);

module.exports = router;