// productProfileController.js — Guards: normalize + unique-by-parent (productTypeId), safer P2002 detail

const { prisma } = require('../lib/prisma');

// ---------- helpers ----------
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// Inline normalizer (เบา ๆ) — align with productTypeController
const toSpaces = (s) => s.replace(/[_-]+/g, ' ').replace(/[ ]+/g, ' ').trim();
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
  return base.replace(/[.]/g, '').replace(/[ ]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ---------- queries ----------
async function findDuplicateProfile({ productTypeId, normalizedName, slug }) {
  if (!productTypeId || (!normalizedName && !slug)) return null;
  return prisma.productProfile.findFirst({
    where: {
      productTypeId,
      OR: [
        ...(normalizedName ? [{ normalizedName }] : []),
        ...(slug ? [{ slug }] : []),
      ],
    },
    select: { id: true, name: true, slug: true, normalizedName: true, pathCached: true }
  });
}

// ✅ POST /product-profiles — create with normalize + unique guard (under productTypeId)
const createProductProfile = async (req, res) => {
  try {
    const { name, description, productTypeId } = req.body || {};

    if (!name || !toInt(productTypeId)) {
      return res.status(400).json({ error: 'ต้องระบุ name และ productTypeId ที่ถูกต้อง' });
    }

    const productTypeIdInt = Number(productTypeId);

    // ensure productType exists
    const pt = await prisma.productType.findUnique({ where: { id: productTypeIdInt }, select: { id: true } });
    if (!pt) return res.status(404).json({ error: 'ไม่พบประเภทสินค้า (productType)' });

    const nameTrim = String(name).trim();
    const normalized = normalizeName(nameTrim);
    const slug = slugify(nameTrim);

    // proactive duplicate check under parent
    const dupe = await findDuplicateProfile({ productTypeId: productTypeIdInt, normalizedName: normalized, slug });
    if (dupe) {
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม',
        level: 'profile',
        parentField: 'productTypeId',
        parentId: productTypeIdInt,
        conflict: dupe,
      });
    }

    const profile = await prisma.productProfile.create({
      data: {
        name: nameTrim,
        normalizedName: normalized,
        slug,
        description: description ? String(description) : null,
        productTypeId: productTypeIdInt,
      },
      include: {
        productType: { select: { id: true, name: true, categoryId: true } },
      },
    });

    res.status(201).json(profile);
  } catch (err) {
    console.error('❌ [Create ProductProfile] Error:', err);
    if (err && err.code === 'P2002') {
      const productTypeIdInt = toInt(req.body?.productTypeId);
      const nameTrim = String(req.body?.name || '').trim();
      const normalized = req.body?.normalizedName || normalizeName(nameTrim);
      const slug = req.body?.slug || slugify(nameTrim);
      const dupe = await findDuplicateProfile({ productTypeId: productTypeIdInt, normalizedName: normalized, slug });
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม',
        level: 'profile',
        parentField: 'productTypeId',
        parentId: productTypeIdInt ?? null,
        conflict: dupe || null,
      });
    }
    res.status(500).json({ error: 'ไม่สามารถสร้างข้อมูลได้' });
  }
};

// ✅ GET /product-profiles — list (q, categoryId, productTypeId)
const getAllProductProfiles = async (req, res) => {
  try {
    const { q, categoryId, productTypeId } = req.query || {};

    const where = omitUndefined({
      ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
      ...(toInt(productTypeId) ? { productTypeId: Number(productTypeId) } : {}),
      ...(toInt(categoryId) ? { productType: { categoryId: Number(categoryId) } } : {}),
    });

    const profiles = await prisma.productProfile.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        productType: { select: { id: true, name: true, categoryId: true } },
      },
    });

    res.json(profiles);
  } catch (err) {
    console.error('❌ [Fetch ProductProfiles] Error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลได้' });
  }
};

// ✅ GET /product-profiles/category/:categoryId — list by category
const getProfilesByCategory = async (req, res) => {
  try {
    const categoryId = toInt(req.params.categoryId);
    if (!categoryId) return res.status(400).json({ error: 'categoryId ไม่ถูกต้อง' });

    const profiles = await prisma.productProfile.findMany({
      where: { productType: { categoryId } },
      include: { productType: { select: { id: true, name: true, categoryId: true } } },
      orderBy: { name: 'asc' },
    });

    res.json(profiles);
  } catch (err) {
    console.error('❌ [Fetch by Category] Error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลตามหมวดหมู่' });
  }
};

// ✅ GET /product-profiles/:id — single
const getProductProfileById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const profile = await prisma.productProfile.findUnique({
      where: { id },
      include: { productType: { select: { id: true, name: true, categoryId: true } } },
    });

    if (!profile) return res.status(404).json({ error: 'ไม่พบข้อมูล' });

    res.json(profile);
  } catch (err) {
    console.error('❌ [Fetch by ID] Error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

// ✅ PATCH /product-profiles/:id — update with normalize + unique guard under target productTypeId
const updateProductProfile = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const { name, description, productTypeId } = req.body || {};

    // validate target productType when provided
    const productTypeIdInt = toInt(productTypeId);
    if (productTypeId !== undefined) {
      if (!productTypeIdInt) return res.status(400).json({ error: 'productTypeId ไม่ถูกต้อง' });
      const pt = await prisma.productType.findUnique({ where: { id: productTypeIdInt }, select: { id: true } });
      if (!pt) return res.status(404).json({ error: 'ไม่พบประเภทสินค้า (productType)' });
    }

    // current row for fallback parent
    const current = await prisma.productProfile.findUnique({ where: { id }, select: { id: true, productTypeId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการอัปเดต' });

    const targetProductTypeId = productTypeIdInt ?? current.productTypeId;

    // prepare name changes
    let nameTrim, normalized, slug;
    if (name !== undefined) {
      if (String(name).trim() === '') return res.status(400).json({ error: 'ชื่อห้ามว่าง' });
      nameTrim = String(name).trim();
      normalized = normalizeName(nameTrim);
      slug = slugify(nameTrim);

      // proactive duplicate check
      const dupe = await findDuplicateProfile({ productTypeId: targetProductTypeId, normalizedName: normalized, slug });
      if (dupe && dupe.id !== id) {
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม',
          level: 'profile',
          parentField: 'productTypeId',
          parentId: targetProductTypeId,
          conflict: dupe,
        });
      }
    }

    const data = omitUndefined({
      name: nameTrim,
      normalizedName: normalized,
      slug,
      description: description !== undefined ? (description ? String(description) : null) : undefined,
      productTypeId: targetProductTypeId !== current.productTypeId ? targetProductTypeId : undefined,
    });

    const updated = await prisma.productProfile.update({
      where: { id },
      data,
      include: { productType: { select: { id: true, name: true, categoryId: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error('❌ [Update ProductProfile] Error:', err);
    if (err && err.code === 'P2025') return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการอัปเดต' });
    if (err && err.code === 'P2002') {
      // build duplicate payload
      const id = toInt(req.params.id);
      const current = await prisma.productProfile.findUnique({ where: { id }, select: { productTypeId: true } });
      const targetProductTypeId = toInt(req.body?.productTypeId) ?? current?.productTypeId;
      const nameTrim = String(req.body?.name || '').trim();
      const normalized = req.body?.normalizedName || normalizeName(nameTrim);
      const slug = req.body?.slug || slugify(nameTrim);
      const dupe = await findDuplicateProfile({ productTypeId: targetProductTypeId, normalizedName: normalized, slug });
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม',
        level: 'profile',
        parentField: 'productTypeId',
        parentId: targetProductTypeId ?? null,
        conflict: dupe || null,
      });
    }
    res.status(500).json({ error: 'ไม่สามารถอัปเดตข้อมูลได้' });
  }
};

// ✅ DELETE /product-profiles/:id — block when used by templates
const deleteProductProfile = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const usedByTemplate = await prisma.productTemplate.findFirst({ where: { productProfileId: id } });
    if (usedByTemplate) {
      return res.status(409).json({ error: 'ลบไม่ได้ เพราะมีเทมเพลตสินค้าที่ใช้งานอยู่' });
    }

    await prisma.productProfile.delete({ where: { id } });
    res.json({ message: 'ลบข้อมูลเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('❌ [Delete ProductProfile] Error:', err);
    if (err && err.code === 'P2025') return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการลบ' });
    if (err && err.code === 'P2003') return res.status(409).json({ error: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' });
    res.status(500).json({ error: 'ไม่สามารถลบข้อมูลได้' });
  }
};

module.exports = {
  createProductProfile,
  getAllProductProfiles,
  getProfilesByCategory,
  getProductProfileById,
  updateProductProfile,
  deleteProductProfile,
};

