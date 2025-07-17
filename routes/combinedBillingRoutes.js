const express = require('express');
const router = express.Router();
const {
  getCombinableSales,
  createCombinedBillingDocument,
  getCombinedBillingById,
  getCustomersWithPendingSales,
} = require('../controllers/combinedBillingController');

const { verifyToken } = require('../middlewares/verifyToken');
router.use(verifyToken);

// ✅ ดึงรายการใบส่งของที่สามารถรวมบิลได้
router.get('/combinable-sales', getCombinableSales);

// ✅ สร้างเอกสาร Combined Billing Document
router.post('/create', createCombinedBillingDocument);

// ✅ ดึงเอกสาร Combined Billing Document รายตัว
router.get('/combined-billing/:id', getCombinedBillingById);

// ✅ ดึงลูกค้าที่มีใบส่งของค้างรวมบิล
router.get('/with-pending-sales', getCustomersWithPendingSales);

module.exports = router;