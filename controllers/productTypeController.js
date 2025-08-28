// controllers/productTypeController.js
// Guards: slug-based unique-by-parent (categoryId), safer P2002 detail

const { prisma } = require('../lib/prisma');

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

// ---------- queries ----------
// NOTE: ถ้า schema ของคุณไม่มี scalar `categoryId` ให้เปลี่ยน where เป็น
// where: { slug, category: { id: categoryId } }
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
    const { q, categoryId } = req.query || {};
    const where = omitUndefined({
      ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
      ...(toInt(categoryId) ? { categoryId: toInt(categoryId) } : {}),
    });

    const productTypes = await prisma.productType.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      include: { category: true },
    });
    res.json(productTypes);
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

// ✅ POST: create (ใช้ slug กันซ้ำภายใต้ categoryId)
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

    // ensure category exists
    const cat = await prisma.category.findUnique({ where: { id: categoryIdInt }, select: { id: true } });
    if (!cat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่สินค้า (category)' });

    const nameTrim = String(name).trim();
    const normalized = normalizeName(nameTrim);
    const slug = slugify(nameTrim);

    // proactive duplicate under parent
    const dupe = await findDuplicateType({ categoryId: categoryIdInt, slug });
    if (dupe) {
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม',
        level: 'type',
        parentField: 'categoryId',
        parentId: categoryIdInt,
        conflict: dupe,
      });
    }

    const created = await prisma.productType.create({
      data: { name: nameTrim, normalizedName: normalized, slug, categoryId: categoryIdInt },
      include: { category: true },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('❌ CREATE ProductType Failed:', err);
    if (err?.code === 'P2002') {
      const categoryIdInt = toInt(req.body?.categoryId);
      const slugVal = req.body?.slug || slugify(req.body?.name);
      const dupe = await findDuplicateType({ categoryId: categoryIdInt, slug: slugVal });
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม',
        level: 'type',
        parentField: 'categoryId',
        parentId: categoryIdInt ?? null,
        conflict: dupe || null,
      });
    }
    res.status(500).json({ error: 'ไม่สามารถเพิ่มประเภทสินค้าได้' });
  }
};

// ✅ PATCH: update (slug ใหม่ + กันซ้ำภายใต้ category ปลายทาง)
const updateProductType = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const { name, categoryId } = req.body || {};

    // validate category if provided
    const categoryIdInt = toInt(categoryId);
    if (categoryId !== undefined) {
      if (!categoryIdInt) return res.status(400).json({ error: 'categoryId ไม่ถูกต้อง' });
      const cat = await prisma.category.findUnique({ where: { id: categoryIdInt }, select: { id: true } });
      if (!cat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่สินค้า (category)' });
    }

    // current row
    const current = await prisma.productType.findUnique({ where: { id }, select: { id: true, categoryId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการอัปเดต' });

    const targetCategoryId = categoryIdInt ?? current.categoryId;

    // prepare changes & proactive duplicate check
    let nameTrim, normalized, slug;
    if (name !== undefined) {
      if (String(name).trim() === '') return res.status(400).json({ error: 'ชื่อประเภทสินค้าต้องไม่ว่าง' });
      nameTrim = String(name).trim();
      normalized = normalizeName(nameTrim);
      slug = slugify(nameTrim);

      const dupe = await findDuplicateType({ categoryId: targetCategoryId, slug });
      if (dupe && dupe.id !== id) {
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม',
          level: 'type',
          parentField: 'categoryId',
          parentId: targetCategoryId,
          conflict: dupe,
        });
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
    if (err?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการอัปเดต' });
    if (err?.code === 'P2002') {
      const id = toInt(req.params.id);
      const current = await prisma.productType.findUnique({ where: { id }, select: { categoryId: true } });
      const targetCategoryId = toInt(req.body?.categoryId) ?? current?.categoryId;
      const slugVal = req.body?.slug || slugify(req.body?.name);
      const dupe = await findDuplicateType({ categoryId: targetCategoryId, slug: slugVal });
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม',
        level: 'type',
        parentField: 'categoryId',
        parentId: targetCategoryId ?? null,
        conflict: dupe || null,
      });
    }
    res.status(500).json({ error: 'ไม่สามารถแก้ไขประเภทสินค้าได้' });
  }
};

// ✅ DELETE
const deleteProductType = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const usedByProfile = await prisma.productProfile.findFirst({ where: { productTypeId: id } });
    if (usedByProfile) {
      return res.status(409).json({ error: 'ลบไม่ได้ เพราะมีโปรไฟล์สินค้าที่ใช้งานอยู่' });
    }

    await prisma.productType.delete({ where: { id } });
    res.json({ message: 'ลบประเภทสินค้าเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('❌ DELETE ProductType Failed:', err);
    if (err?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการลบ' });
    if (err?.code === 'P2003') return res.status(409).json({ error: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' });
    res.status(500).json({ error: 'ไม่สามารถลบประเภทสินค้าได้' });
  }
};

// ✅ dropdowns
const getProductTypeDropdowns = async (req, res) => {
  try {
    const types = await prisma.productType.findMany({
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
  deleteProductType,
  getProductTypeDropdowns,
};

