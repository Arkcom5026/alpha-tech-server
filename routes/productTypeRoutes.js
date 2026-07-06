// ✅ routes/productTypeRoutes.js (secured with admin guard, archive/restore instead of hard delete)
const express = require('express');
const router = express.Router();

const {
  getAllProductType,
  getProductTypeById,
  createProductType,
  updateProductType,
  // deleteProductType, // ❌ ไม่ใช้แล้ว (เปลี่ยนเป็น archive/restore)
  archiveProductType,
  restoreProductType,
  getProductTypeDropdowns,
} = require('../controllers/productTypeController');

const { prisma } = require('../lib/prisma');
const verifyToken = require('../middlewares/verifyToken');
const requireAdmin = require('../middlewares/requireAdmin');

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : parseInt(v, 10));
const TEMPLATE_BRANCH_CODE = 'T01';
const TEMPLATE_BRANCH_ID_FALLBACK = 1;

// ✅ ทุก route ต้องผ่านการยืนยันตัวตนก่อน
router.use(verifyToken);

// ⚠️ วาง route เฉพาะเจาะจงก่อน `/:id` เสมอ
router.get('/dropdowns', getProductTypeDropdowns); // GET /api/product-types/dropdowns

// GET /api/product-types/template-options
// ใช้ในหน้าเพิ่มประเภทสินค้า: คัดลอก ProductType จากสาขาต้นแบบ แล้วสร้างเป็นของร้านปัจจุบัน
router.get('/template-options', async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) {
      return res.status(403).json({
        error: 'BRANCH_REQUIRED',
        message: 'ไม่พบข้อมูลสาขาใน token กรุณาเข้าสู่ระบบใหม่',
      });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        categoryId: true,
        category: { select: { id: true, name: true, active: true } },
      },
    });

    if (!branch?.categoryId) {
      return res.status(400).json({
        error: 'BRANCH_CATEGORY_REQUIRED',
        message: 'ไม่พบประเภทธุรกิจของร้าน กรุณาตรวจสอบข้อมูลสาขาก่อน',
      });
    }

    const templateBranch = await prisma.branch.findFirst({
      where: {
        OR: [
          { branchCode: TEMPLATE_BRANCH_CODE },
          { id: TEMPLATE_BRANCH_ID_FALLBACK },
        ],
      },
      select: { id: true, name: true, branchCode: true, categoryId: true },
      orderBy: { id: 'asc' },
    });

    if (!templateBranch?.id) {
      return res.status(404).json({
        error: 'TEMPLATE_BRANCH_NOT_FOUND',
        message: 'ไม่พบสาขาต้นแบบสำหรับคัดลอกประเภทสินค้า',
      });
    }

    const items = await prisma.productType.findMany({
      where: {
        branchId: templateBranch.id,
        categoryId: branch.categoryId,
        active: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        categoryId: true,
        branchId: true,
        globalProductTypeId: true,
        category: { select: { id: true, name: true } },
        _count: {
          select: {
            productTypeBrands: true,
            Product: true,
          },
        },
      },
    });

    res.set('Cache-Control', 'no-store');
    return res.json({
      category: branch.category,
      templateBranch,
      items: items.map((item) => ({
        ...item,
        brandCount: item?._count?.productTypeBrands || 0,
        productCount: item?._count?.Product || 0,
      })),
    });
  } catch (err) {
    console.error('❌ GET ProductType template-options Failed:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดประเภทสินค้าจากสาขาต้นแบบได้' });
  }
});

// 🔎 อ่านข้อมูล (ให้ผู้ใช้ที่ล็อกอินเห็นได้ตามปกติ)
router.get('/', getAllProductType);               // GET /api/product-types
router.get('/:id', getProductTypeById);           // GET /api/product-types/:id

// 🔐 จัดการข้อมูล (Admin เท่านั้น)
router.post('/', requireAdmin, createProductType);                // POST /api/product-types
router.patch('/:id', requireAdmin, updateProductType);            // PATCH /api/product-types/:id
router.patch('/:id/archive', requireAdmin, archiveProductType);   // PATCH /api/product-types/:id/archive
router.patch('/:id/restore', requireAdmin, restoreProductType);   // PATCH /api/product-types/:id/restore

module.exports = router;