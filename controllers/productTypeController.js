// controllers/productTypeController.js
// Guards: slug-based unique-by-parent (categoryId), safer P2002 detail

const { prisma, Prisma } = require('../lib/prisma');
const MAX_LIMIT = 100;

// ---------- helpers ----------
const toInt = (v) =>
  v === undefined || v === null || v === '' ? undefined : parseInt(v, 10);
const omitUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// Inline normalizer/slugify (ไม่พึ่ง external deps)
const toSpaces = (s) => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const stripPunct = (s) => s.replace(/[^A-Za-z0-9ก-๙ .]/g, '');
function normalizeName(raw) {
  if (!raw) return '';
  let s = String(raw).normalize('NFC');
  s = toSpaces(stripPunct(s)).toLowerCase();
  return s;
}
function slugify(raw) {
  if (!raw) return '';
  const base = normalizeName(raw);
  return base.replace(/\./g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ---------- parent category guard ----------
async function getCategoryGuardInfo(categoryId) {
  if (!categoryId) return null;
  return prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, active: true, isSystem: true, name: true },
  });
}

// ---------- queries ----------
async function findDuplicateType({ categoryId, slug }) {
  if (!categoryId || !slug) return null;
  return prisma.productType.findFirst({
    where: { categoryId, slug },
    select: { id: true, name: true, slug: true, pathCached: true },
  });
}

// ✅ GET: list
const getAllProductType = async (req, res) => {
  try {
    const { q, categoryId, includeInactive, page: pageQ, limit: limitQ } = req.query || {};
    const pageRaw = Number(pageQ);
    const limitRaw = Number(limitQ);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 20;

    const where = omitUndefined({
      ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
      ...(toInt(categoryId) ? { categoryId: toInt(categoryId) } : {}),
      ...((String(includeInactive || '').toLowerCase() === 'true') ? {} : { active: true }),
    });

    const [total, items] = await Promise.all([
      prisma.productType.count({ where }),
      prisma.productType.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { category: true },
      }),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({ items, total, page, limit });
  } catch (err) {
    console.error('❌ GET ProductTypes Failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ✅ GET: single
const getProductTypeById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const productType = await prisma.productType.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!productType) {
      return res.status(404).json({ error: 'ไม่พบประเภทสินค้านี้' });
    }

    res.json(productType);
  } catch (err) {
    console.error('❌ getProductTypeById error:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลประเภทสินค้าได้' });
  }
};

// ✅ POST: create
const createProductType = async (req, res) => {
  try {
    const { name, categoryId } = req.body || {};

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ error: 'กรุณาระบุชื่อประเภทสินค้า' });
    }
    const categoryIdInt = toInt(categoryId);
    if (!categoryIdInt) {
      return res.status(400).json({ error: 'กรุณาระบุหมวดหมู่สินค้า (categoryId) ให้ถูกต้อง' });
    }

    const cat = await getCategoryGuardInfo(categoryIdInt);
    if (!cat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่สินค้า (category)' });
    if (cat.isSystem) return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้แก้ไข/เพิ่มข้อมูลย่อย' });
    if (cat.active === false) return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'หมวดหมู่ถูกปิดการใช้งานอยู่ กรุณากู้คืนหมวดหมู่ก่อน' });

    const nameTrim = String(name).trim();
    const normalized = normalizeName(nameTrim);
    const slug = slugify(nameTrim);

    // Pre-check to return conflict detail (UX ดีกว่า)
    const dupe = await findDuplicateType({ categoryId: categoryIdInt, slug });
    if (dupe) {
      return res.status(409).json({ error: 'DUPLICATE', message: 'พบรายการเดิม', conflict: dupe });
    }

    const created = await prisma.productType.create({
      data: { name: nameTrim, normalizedName: normalized, slug, categoryId: categoryIdInt, active: true },
      include: { category: true },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('❌ CREATE ProductType Failed:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Race condition guard: unique (categoryId, slug)
      return res.status(409).json({ error: 'DUPLICATE', message: 'พบรายการเดิม (unique constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถเพิ่มประเภทสินค้าได้' });
  }
};

// ✅ PATCH: update
const updateProductType = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const { name, categoryId } = req.body || {};
    const categoryIdInt = toInt(categoryId);

    const current = await prisma.productType.findUnique({ where: { id }, select: { id: true, categoryId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการอัปเดต' });

    const currentCat = await getCategoryGuardInfo(current.categoryId);
    if (currentCat?.isSystem) return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้แก้ไขข้อมูลย่อย' });

    const targetCategoryId = categoryId !== undefined ? categoryIdInt : current.categoryId;
    if (categoryId !== undefined) {
      if (!categoryIdInt) return res.status(400).json({ error: 'categoryId ไม่ถูกต้อง' });
      const targetCat = await getCategoryGuardInfo(categoryIdInt);
      if (!targetCat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่สินค้า (category)' });
      if (targetCat.isSystem) return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้ย้าย/เพิ่มข้อมูลย่อย' });
      if (targetCat.active === false) return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'หมวดหมู่ปลายทางถูกปิดการใช้งานอยู่ กรุณากู้คืนก่อน' });
    }

    let nameTrim, normalized, slug;
    if (name !== undefined) {
      if (String(name).trim() === '') return res.status(400).json({ error: 'ชื่อประเภทสินค้าต้องไม่ว่าง' });
      nameTrim = String(name).trim();
      normalized = normalizeName(nameTrim);
      slug = slugify(nameTrim);

      const dupe = await findDuplicateType({ categoryId: targetCategoryId, slug });
      if (dupe && dupe.id !== id) {
        return res.status(409).json({ error: 'DUPLICATE', message: 'พบรายการเดิม', conflict: dupe });
      }
    }

    const data = omitUndefined({
      name: nameTrim,
      normalizedName: normalized,
      slug,
      categoryId: targetCategoryId !== current.categoryId ? targetCategoryId : undefined,
    });

    const updated = await prisma.productType.update({
      where: { id },
      data,
      include: { category: true },
    });

    res.json(updated);
  } catch (err) {
    console.error('❌ UPDATE ProductType Failed:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'DUPLICATE', message: 'พบรายการเดิม (unique constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขประเภทสินค้าได้' });
  }
};

// ✅ Archive: set active=false (block if referenced)
const archiveProductType = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productType.findUnique({ where: { id }, select: { id: true, active: true, categoryId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการปิดการใช้งาน' });

    const cat = await getCategoryGuardInfo(current.categoryId);
    if (cat?.isSystem) return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้ปิดการใช้งานข้อมูลย่อย' });

    const usedByProfile = await prisma.productProfile.findFirst({ where: { productTypeId: id } });
    if (usedByProfile) {
      return res.status(409).json({
        error: 'HAS_REFERENCES',
        message: 'ไม่สามารถปิดการใช้งานได้ เนื่องจากมีการอ้างอิงอยู่ (productProfile)',
      });
    }

    if (current.active === false) {
      return res.json({ message: 'ประเภทสินค้านี้ถูกปิดการใช้งานอยู่แล้ว', id });
    }

    await prisma.productType.update({ where: { id }, data: { active: false } });
    return res.json({ message: 'ปิดการใช้งานประเภทสินค้าเรียบร้อย', id });
  } catch (err) {
    console.error('❌ ARCHIVE ProductType Failed:', err);
    return res.status(500).json({ error: 'ไม่สามารถปิดการใช้งานประเภทสินค้าได้' });
  }
};

// ✅ Restore: set active=true
const restoreProductType = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productType.findUnique({ where: { id }, select: { id: true, active: true, categoryId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการกู้คืน' });

    const cat = await getCategoryGuardInfo(current.categoryId);
    if (cat?.active === false) return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'หมวดหมู่ถูกปิดการใช้งานอยู่ กรุณากู้คืนหมวดหมู่ก่อน' });

    if (current.active === true) {
      return res.json({ message: 'ประเภทสินค้านี้อยู่ในสถานะใช้งานแล้ว', id });
    }

    await prisma.productType.update({ where: { id }, data: { active: true } });
    return res.json({ message: 'กู้คืนประเภทสินค้าเรียบร้อย', id });
  } catch (err) {
    console.error('❌ RESTORE ProductType Failed:', err);
    return res.status(500).json({ error: 'ไม่สามารถกู้คืนประเภทสินค้าได้' });
  }
};

// ✅ dropdowns
const getProductTypeDropdowns = async (req, res) => {
  try {
    const types = await prisma.productType.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json(types);
  } catch (err) {
    console.error('❌ getProductTypeDropdowns error:', err);
    res.status(500).json({ error: 'Failed to load product types' });
  }
};

module.exports = {
  getAllProductType,
  getProductTypeById,
  createProductType,
  updateProductType,
  archiveProductType,
  restoreProductType,
  getProductTypeDropdowns,
};



