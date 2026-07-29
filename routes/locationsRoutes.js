// =============================================================
// Module: routes/locationsRoutes.js
// Desc: Backend Router for Locations Module (Standard Clean Arrays)
// Convention: Project #1 (Frontend = ESM; Backend = CommonJS).
// =============================================================

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');

// นำเข้าคอนโทรลเลอร์ถอดรหัสพิกัดส่วนกลางมาร่วมดักจับฟังก์ชัน /resolve
const { addressController } = require('../controllers/addressController');

// Public + simple caching for reference data
router.use((req, res, next) => {
  res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=60'); //
  next(); //
});

// GET /api/locations/provinces
// 🟢 FIXED: ถอดการครอบ { items } ออก ส่งคืน Array ดิบตรง ๆ เพื่อล้างบั๊ก Dropdown ดับมืดค้าง
router.get('/provinces', async (_req, res) => {
  try {
    const items = await prisma.province.findMany({
      orderBy: { nameTh: 'asc' }, //
      select: { code: true, nameTh: true, region: true }, //
    });
    return res.json(items); // 🔒 ส่ง Array ดิบตรง ๆ ตามสเปกที่ FE คาดหวัง
  } catch (err) {
    console.error('❌ [locations.provinces] error', err); //
    return res.status(500).json({ message: 'Internal Server Error' }); //
  }
});

// GET /api/locations/districts?provinceCode=xx
// 🟢 FIXED: ถอดการครอบ { items } ส่งคืน Array ดิบ
router.get('/districts', async (req, res) => {
  try {
    const provinceCode = String(req.query?.provinceCode || '').trim(); //
    if (!provinceCode) return res.status(400).json({ message: 'provinceCode is required' }); //
    
    const items = await prisma.district.findMany({
      where: { provinceCode }, //
      orderBy: { nameTh: 'asc' }, //
      select: { code: true, nameTh: true }, //
    });
    return res.json(items); // 🔒 ส่ง Array ดิบ
  } catch (err) {
    console.error('❌ [locations.districts] error', err); //
    return res.status(500).json({ message: 'Internal Server Error' }); //
  }
});

// GET /api/locations/subdistricts?districtCode=xxx
// 🟢 FIXED: ถอดการครอบ { items } ส่งคืน Array ดิบ
router.get('/subdistricts', async (req, res) => {
  try {
    const districtCode = String(req.query?.districtCode || '').trim(); //
    if (!districtCode) return res.status(400).json({ message: 'districtCode is required' }); //
    
    const items = await prisma.subdistrict.findMany({
      where: { districtCode }, //
      orderBy: { nameTh: 'asc' }, //
      select: { code: true, nameTh: true, postcode: true }, //
    });
    return res.json(items); // 🔒 ส่ง Array ดิบ
  } catch (err) {
    console.error('❌ [locations.subdistricts] error', err); //
    return res.status(500).json({ message: 'Internal Server Error' }); //
  }
});

// ─────────────────────────────────────────────────────────────
// 🟢 ADDED UTILITIES: เปิดช่องรับพิกัดข้ามสายเพื่อรองรับระบบหน้าบ้านหน้าร้าน POS สมบูรณ์ร้อยเปอร์เซ็นต์
// ─────────────────────────────────────────────────────────────
router.get('/resolve', addressController.resolve);
router.get('/validate', addressController.validate);
router.get('/postcode', addressController.postcode);
router.get('/search', addressController.search);
router.post('/join', addressController.join);

module.exports = router;