// =============================================================
// controllers/addressController.js
// Desc: Address utilities API — resolve ADM, validate codes, join address
// Convention: CommonJS (Project #1)
// NOTE: Cleaned up duplicate Prisma imports; aligned error handling with bankController
// =============================================================

const { prisma, Prisma } = require('../lib/prisma');
const { addressUtil } = require('../utils/address');

// ---- helpers --------------------------------------------------
const toStr = (v) => (v === undefined || v === null ? undefined : String(v));
const trimOrUndefined = (v) => {
  const s = toStr(v);
  return s && s.trim() ? s.trim() : undefined;
};

const sendKnownPrismaError = (res, err, fallbackMsg) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return res.status(400).json({ error: fallbackMsg });
  }
  return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
};

// =============================================================
// Controller
// =============================================================
const addressController = {
  /**
   * GET /api/address/resolve?subdistrictCode=xxxx[&address=...][&postalCode=...]
   * - คืนชื่อ ตำบล/อำเภอ/จังหวัด + region + postalCode (resolve จาก ADM)
   * - ถ้าส่ง address/postalCode มาด้วย จะคืน fullAddress (join ตามกฎ [81])
   */
  resolve: async (req, res) => {
    try {
      const subdistrictCode = trimOrUndefined(req.query?.subdistrictCode);
      const address = trimOrUndefined(req.query?.address);
      const postalCode = trimOrUndefined(req.query?.postalCode);

      if (!subdistrictCode) return res.status(400).json({ message: 'กรุณาระบุ subdistrictCode' });

      const sd = await prisma.subdistrict.findUnique({
        where: { code: subdistrictCode },
        include: { district: { include: { province: true } } },
      });
      if (!sd) return res.status(404).json({ message: 'ไม่พบรหัสตำบล (subdistrictCode) นี้' });

      const result = {
        // codes for FE auto-fill
        provinceCode: sd.district?.provinceCode,
        districtCode: sd.district?.code,
        subdistrictCode: sd.code,
        // names for display
        subdistrictName: sd.nameTh,
        districtName: sd.district?.nameTh,
        provinceName: sd.district?.province?.nameTh,
        region: sd.district?.province?.region || undefined,
        postalCode: postalCode || sd.postcode || undefined,
      };

      if (address || result.postalCode) {
        result.fullAddress = addressUtil.joinAddress({
          address,
          subdistrict: result.subdistrictName,
          district: result.districtName,
          province: result.provinceName,
          postalCode: result.postalCode,
        });
      }

      return res.json(result);
    } catch (err) {
      console.error('❌ [address.resolve] error:', err);
      return sendKnownPrismaError(res, err, 'เกิดข้อผิดพลาดในการดึงข้อมูลที่อยู่');
    }
  },

  /**
   * GET /api/address/validate?subdistrictCode=xxxx
   */
  validate: async (req, res) => {
    try {
      const subdistrictCode = trimOrUndefined(req.query?.subdistrictCode);
      if (!subdistrictCode) return res.status(400).json({ message: 'กรุณาระบุ subdistrictCode' });

      const exists = await prisma.subdistrict.findUnique({ where: { code: subdistrictCode } });
      return res.json({ valid: !!exists });
    } catch (err) {
      console.error('❌ [address.validate] error:', err);
      return sendKnownPrismaError(res, err, 'เกิดข้อผิดพลาดในการตรวจสอบรหัสตำบล');
    }
  },

  /**
   * GET /api/address/postcode?subdistrictCode=xxxx
   */
  postcode: async (req, res) => {
    try {
      const subdistrictCode = trimOrUndefined(req.query?.subdistrictCode);
      if (!subdistrictCode) return res.status(400).json({ message: 'กรุณาระบุ subdistrictCode' });

      const sd = await prisma.subdistrict.findUnique({ where: { code: subdistrictCode } });
      if (!sd) return res.status(404).json({ message: 'ไม่พบรหัสตำบล (subdistrictCode) นี้' });
      return res.json({ postalCode: sd.postcode || null });
    } catch (err) {
      console.error('❌ [address.postcode] error:', err);
      return sendKnownPrismaError(res, err, 'เกิดข้อผิดพลาดในการดึงรหัสไปรษณีย์');
    }
  },

  /**
   * GET /api/address/search?q=keyword
   * - ค้นหา province/district/subdistrict แบบ contains (insensitive)
   */
  search: async (req, res) => {
    try {
      const q = trimOrUndefined(req.query?.q);
      if (!q || q.length < 2) return res.json({ provinces: [], districts: [], subdistricts: [] });

      const [provinces, districts, subdistricts] = await Promise.all([
        prisma.province.findMany({
          where: { nameTh: { contains: q, mode: 'insensitive' } },
          select: { code: true, nameTh: true, region: true },
          take: 10,
          orderBy: { nameTh: 'asc' },
        }),
        prisma.district.findMany({
          where: { nameTh: { contains: q, mode: 'insensitive' } },
          select: { code: true, nameTh: true, provinceCode: true },
          take: 10,
          orderBy: { nameTh: 'asc' },
        }),
        prisma.subdistrict.findMany({
          where: { nameTh: { contains: q, mode: 'insensitive' } },
          select: { code: true, nameTh: true, districtCode: true, postcode: true },
          take: 10,
          orderBy: { nameTh: 'asc' },
        }),
      ]);

      return res.json({ provinces, districts, subdistricts });
    } catch (err) {
      console.error('❌ [address.search] error:', err);
      return sendKnownPrismaError(res, err, 'เกิดข้อผิดพลาดในการค้นหาที่อยู่');
    }
  },

  /**
   * POST /api/address/join
   * body: { address?, subdistrictCode, postalCode? }
   * - รวมสตริงที่อยู่เดียวตามกฎ [81]
   */
  join: async (req, res) => {
    try {
      const address = trimOrUndefined(req.body?.address);
      const subdistrictCode = trimOrUndefined(req.body?.subdistrictCode);
      const postalCode = trimOrUndefined(req.body?.postalCode);
      if (!subdistrictCode) return res.status(400).json({ message: 'กรุณาระบุ subdistrictCode' });

      const adm = await addressUtil.getAdmFromSubdistrictCode(subdistrictCode);
      if (!adm.subdistrict) return res.status(404).json({ message: 'ไม่พบรหัสตำบล (subdistrictCode) นี้' });

      const joined = addressUtil.joinAddress({
        address,
        subdistrict: adm.subdistrict,
        district: adm.district,
        province: adm.province,
        postalCode: postalCode || adm.postcode,
      });
      return res.json({ address: joined });
    } catch (err) {
      console.error('❌ [address.join] error:', err);
      return sendKnownPrismaError(res, err, 'เกิดข้อผิดพลาดในการรวมที่อยู่');
    }
  },

  // -----------------------------------------------------------
  // Lists for FE (province/district/subdistrict)
  // GET /api/address/provinces  → [{ code, nameTh }]
  listProvinces: async (req, res) => {
    try {
      const items = await prisma.province.findMany({
        select: { code: true, nameTh: true },
        orderBy: { nameTh: 'asc' },
      });
      return res.json(items);
    } catch (err) {
      console.error('❌ [address.listProvinces] error:', err);
      return sendKnownPrismaError(res, err, 'เกิดข้อผิดพลาดในการดึงจังหวัด');
    }
  },

  // GET /api/address/districts?provinceCode=XX  → [{ code, nameTh }]
  listDistricts: async (req, res) => {
    try {
      const provinceCode = trimOrUndefined(req.query?.provinceCode);
      if (!provinceCode) return res.status(400).json({ message: 'provinceCode is required' });

      const items = await prisma.district.findMany({
        where: { provinceCode: String(provinceCode) },
        select: { code: true, nameTh: true },
        orderBy: { nameTh: 'asc' },
      });
      return res.json(items);
    } catch (err) {
      console.error('❌ [address.listDistricts] error:', err);
      return sendKnownPrismaError(res, err, 'เกิดข้อผิดพลาดในการดึงอำเภอ');
    }
  },

  // GET /api/address/subdistricts?districtCode=XXXX  → [{ code, nameTh, postcode }]
  listSubdistricts: async (req, res) => {
    try {
      const districtCode = trimOrUndefined(req.query?.districtCode);
      if (!districtCode) return res.status(400).json({ message: 'districtCode is required' });

      const items = await prisma.subdistrict.findMany({
        where: { districtCode: String(districtCode) },
        select: { code: true, nameTh: true, postcode: true },
        orderBy: { nameTh: 'asc' },
      });
      return res.json(items);
    } catch (err) {
      console.error('❌ [address.listSubdistricts] error:', err);
      return sendKnownPrismaError(res, err, 'เกิดข้อผิดพลาดในการดึงตำบล');
    }
  },
};

module.exports.addressController = addressController;

// --- Example wire-up (routes/addressRoutes.js) ---
// const express = require('express');
// const { verifyToken } = require('../middlewares/verifyToken');
// const { addressController } = require('../controllers/addressController');
// const router = express.Router();
// router.use(verifyToken);
// // lookup lists
// router.get('/provinces', addressController.listProvinces);
// router.get('/districts', addressController.listDistricts);
// router.get('/subdistricts', addressController.listSubdistricts);
// // utilities
// router.get('/resolve', addressController.resolve);
// router.get('/validate', addressController.validate);
// router.get('/postcode', addressController.postcode);
// router.get('/search', addressController.search);
// router.post('/join', addressController.join);
// module.exports = router;
