// src/modules/procurement/routes/procurementRoutes.js
const express = require('express');
const router = express.Router();
const procurementController = require('../controllers/procurementController');
const { protect, restrictTo } = require('../../../middlewares/authGuard');

// ท่อส่ง API คอนฟิกความปลอดภัยและบทบาทพนักงานเข้าควบคุมระบบจัดจัดซื้อและคลังสินค้า v2

// =========================================================================
// 🟢 [MIGRATION CONNECTOR] รองรับการทยอยย้ายโฟลว์จาก Route ตัวนอกสุด (พอร์ต 5000)
// เพื่อจับคู่ชื่อฟังก์ชันดั้งเดิมให้วิ่งตกกระทบหาโครงสร้างคลังข้อมูลจัดซื้อ v2 ได้อย่างแม่นยำ
// =========================================================================
router.get(
  '/',
  protect,
  // ชี้เป้าไปหาฟังก์ชันดึงประวัติจัดซื้อตัวจริงใน Controller v2 (ปรับชื่อตามเนื้อผ้าอินเตอร์เฟสหลัก)
  procurementController.getAllPurchaseOrders || procurementController.getReceiptsForBarcode
);

// 1. บริหารจัดการประวัติคู่ค้าและการประเมินหนี้สินจัดส่ง (Suppliers AP Debt)
router.post(
  '/suppliers',
  protect,
  procurementController.createSupplier
);

router.get(
  '/suppliers/:supplierId/credit',
  protect,
  procurementController.checkCreditLimit
);

router.post(
  '/supplier/:supplierId/settle-debt',
  protect,
  restrictTo('OWNER'), // สงวนสิทธิ์ระบบลดยอดหนี้สะสมการเงินเฉพาะบทบาท OWNER
  procurementController.settleDebt
);

// 2. ควบคุมจัดการเอกสารบิลจัดซื้อจัดจ้างและใบรับของภาษี (Orders & AP Ingestion)
router.post(
  '/orders',
  protect,
  restrictTo('OWNER', 'MANAGER'), // ป้องกันการป้อนบิลจัดซื้อที่มีความเสี่ยงทางการเงินโดยไม่ผ่านการอนุมัติ
  procurementController.createPO
);

router.post(
  '/orders/:poId/receive',
  protect,
  restrictTo('OWNER', 'MANAGER'),
  procurementController.receivePO
);

// 3. อินเตอร์เฟสพิมพ์ป้ายจัดเตรียมพิมพ์และบาร์โค้ดผลิตภัณฑ์ (Barcodes)
router.get(
  '/barcodes',
  protect,
  restrictTo('OWNER', 'MANAGER'),
  procurementController.getReceiptsForBarcode
);

router.get(
  '/barcodes/:receiptId/preview',
  protect,
  restrictTo('OWNER', 'MANAGER'),
  procurementController.getBarcodePreview
);

// 4. ระบบอินเตอร์เฟสยิงสแกนคลังพัสดุและอนุมัติปิดยอดงบประมาณ (Scanning & Finalize)
router.get(
  '/receipts/pending-scan',
  protect,
  restrictTo('OWNER', 'MANAGER'),
  procurementController.getPendingScanReceipts
);

router.post(
  '/receipts/:receiptId/scan',
  protect,
  restrictTo('CASHIER', 'MANAGER', 'OWNER'), // พนักงานทั่วไป Cashier ได้รับสิทธิ์สแกนนำของเข้าคลังได้หน้างาน
  procurementController.scanSerialItem
);

router.post(
  '/receipts/:receiptId/finalize',
  protect,
  restrictTo('OWNER', 'MANAGER'), // บังคับสิทธิ์ระดับบริหารเท่านั้นที่จะสามารถเซ็นตรวจปิดงบล็อตสต็อกนี้ได้
  procurementController.finalizeReceipt
);

module.exports = router;