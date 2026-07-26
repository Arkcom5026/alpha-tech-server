// ✅ purchaseOrderRoutes.js (Safe Hybrid Migration Version - Port 5000)
const express = require('express');
const router = express.Router();

// 🟢 [NEW STRATEGY] ทยอยย้ายตัวดึงประวัติ (getAllPurchaseOrders) เข้าโครงสร้างใหม่ v2
const {
  getAllPurchaseOrders
} = require('../src/modules/procurement/controllers/procurementController');

// ⚪ [BACKWARD COMPATIBILITY] ฟังก์ชันที่เหลือทั้งหมด ดึงจาก Controller ตัวเดิมด้านนอกชั่วคราว
const {
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  updatePurchaseOrderStatus,
  getPurchaseOrdersBySupplier,
  createPurchaseOrderWithAdvance,
} = require('../controllers/purchaseOrderController');

const listEligiblePurchaseOrdersController = require('../src/modules/procurement/receipt/query/eligible-purchase-orders/listEligiblePurchaseOrdersController');
const getReceiptPurchaseOrderController = require('../src/modules/procurement/receipt/query/purchase-order-detail/getReceiptPurchaseOrderController');

const verifyToken = require('../middlewares/verifyToken');
router.use(verifyToken);

// 🧭 สลับสายเน็ตเวิร์กเฉพาะจุด (Granular Routing)
router.get('/', getAllPurchaseOrders); // 🎯 ฟังก์ชันนี้ย้ายเข้าระบบใหม่ v2 สำเร็จแล้ว!
router.post('/', createPurchaseOrder); // ⏳ รอคิวรีแฟกเตอร์ถัดไป (ใช้ของเดิมอยู่)
router.get('/by-supplier', getPurchaseOrdersBySupplier);
router.post('/with-advance', createPurchaseOrderWithAdvance);

// ✅ ตัวเสริมฝั่งตรวจรับใบสั่งซื้อ
router.get('/eligible-for-receipt', listEligiblePurchaseOrdersController.handle);
router.get('/:id/detail-for-receipt', getReceiptPurchaseOrderController.handle);
router.put('/:id', updatePurchaseOrder);
router.delete('/:id', deletePurchaseOrder);
router.get('/:id', getPurchaseOrderById);
router.patch('/:id/status', updatePurchaseOrderStatus);

module.exports = router;
