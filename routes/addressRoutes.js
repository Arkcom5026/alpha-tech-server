// =============================================================
// Module: routes/addressRoutes.js
// Desc: Backend Router for Thailand ADM Module (Province → District → Subdistrict)
// Convention: Project #1 (Frontend = ESM; Backend = CommonJS).
// =============================================================

const express = require('express');
const router = express.Router();

// นำเข้าคอนโทรลเลอร์ถอดรหัสพิกัดที่อยู่ตรงตัวตามมาตรฐาน
const { addressController } = require('../controllers/addressController');

// 🔒 SECURITY LAYER: หากต้องการความปลอดภัยระดับพนักงาน สามารถเปิดใช้งาน middleware ดักได้
// const verifyToken = require('../middlewares/verifyToken');
// router.use(verifyToken);

// ─────────────────────────────────────────────────────────────
// 🟢 ALIGNED ROUTEMAP: ผูกเลนสัญญานทางเดินพาสเวิร์ดให้ตรงบล็อกหน้าบ้านเป๊ะๆ สยบ 404 ทันที
// ─────────────────────────────────────────────────────────────

// lookup lists (ดักจับคำขอเพื่อโหลดข้อมูลส่งไปป้อน Dropdown หน้าร้าน)
router.get('/provinces', addressController.listProvinces);
router.get('/districts', addressController.listDistricts);
router.get('/subdistricts', addressController.listSubdistricts);

// utilities (สยบ 404 ของชุดประมวลผลการคำนวณถอดพิกัดย้อนหลังลูกค้าเก่า/ใหม่)
router.get('/resolve', addressController.resolve);
router.get('/validate', addressController.validate);
router.get('/postcode', addressController.postcode);
router.get('/search', addressController.search);
router.post('/join', addressController.join);

module.exports = router;