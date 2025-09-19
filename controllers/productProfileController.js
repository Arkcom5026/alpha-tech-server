// productProfileController.js — Guards: normalize + unique-by-parent (productTypeId), safer P2002 detail

const { prisma } = require('../lib/prisma');
const MAX_LIMIT = 100;

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

// ---------- parent guards ----------
async function getProductTypeGuardInfo(productTypeId) {
  if (!productTypeId) return null;
  return prisma.productType.findUnique({
    where: { id: productTypeId },
    select: {
      id: true,
      active: true,
      name: true,
      category: { select: { id: true, name: true, active: true, isSystem: true } },
    },
  });
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
    if (String(name).trim().length > 80) {
      return res.status(400).json({ error: 'ชื่อยาวเกินไป (สูงสุด 80 ตัวอักษร)' });
    }

    const productTypeIdInt = toInt(productTypeId);
    const pt = await getProductTypeGuardInfo(productTypeIdInt);
    if (!pt) return res.status(404).json({ error: 'ไม่พบประเภทสินค้า (productType)' });
    if (pt.category?.isSystem) return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้เพิ่มข้อมูลย่อย' });
    if (pt.active === false || pt.category?.active === false) {
      return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'ประเภทสินค้า/หมวดหมู่ถูกปิดการใช้งานอยู่ กรุณากู้คืนก่อน' });
    }

    const nameTrim = String(name).trim();
    const normalized = normalizeName(nameTrim);
    const slug = slugify(nameTrim);

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
        active: true,
      },
      include: {
        productType: { select: { id: true, name: true, categoryId: true } },
      },
    });

    res.status(201).json(profile);
  } catch (err) {
    console.error('❌ [Create ProductProfile] Error:', err);
    if (err && err.code === 'P2002') {
      try {
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
      } catch (e) { /* noop */ }
    }
    res.status(500).json({ error: 'ไม่สามารถสร้างข้อมูลได้' });
  }
};

// ✅ GET /product-profiles — list (q, categoryId, productTypeId)
const getAllProductProfiles = async (req, res) => {
  try {
    const { q, categoryId, productTypeId, includeInactive, page: pageQ, limit: limitQ } = req.query || {};

    const pageRaw = Number(pageQ);
    const limitRaw = Number(limitQ);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 20;

    const where = omitUndefined({
      ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
      ...(toInt(productTypeId) ? { productTypeId: toInt(productTypeId) } : {}),
      ...(toInt(categoryId) ? { productType: { categoryId: toInt(categoryId) } } : {}),
      ...((String(includeInactive || '').toLowerCase() === 'true') ? {} : { active: true }),
    });

    const [total, items] = await Promise.all([
      prisma.productProfile.count({ where }),
      prisma.productProfile.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { productType: { select: { id: true, name: true, categoryId: true } } },
      }),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({ items, total, page, limit });
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
    const productTypeIdInt = toInt(productTypeId);

    // current
    const current = await prisma.productProfile.findUnique({ where: { id }, select: { id: true, productTypeId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการอัปเดต' });

    // guard on current parent (หมวดระบบห้ามแก้ไขข้อมูลย่อย)
    const currentPT = await getProductTypeGuardInfo(current.productTypeId);
    if (currentPT?.category?.isSystem) return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้แก้ไขข้อมูลย่อย' });

    // target parent (if changing)
    let targetProductTypeId = current.productTypeId;
    if (productTypeId !== undefined) {
      if (!productTypeIdInt) return res.status(400).json({ error: 'productTypeId ไม่ถูกต้อง' });
      const targetPT = await getProductTypeGuardInfo(productTypeIdInt);
      if (!targetPT) return res.status(404).json({ error: 'ไม่พบประเภทสินค้า (productType)' });
      if (targetPT.category?.isSystem) return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้ย้าย/เพิ่มข้อมูลย่อย' });
      if (targetPT.active === false || targetPT.category?.active === false) {
        return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'ประเภทสินค้า/หมวดปลายทางถูกปิดการใช้งานอยู่ กรุณากู้คืนก่อน' });
      }
      targetProductTypeId = productTypeIdInt;
    }

    // name changes & duplicate guard
    let nameTrim, normalized, slug;
    if (name !== undefined) {
      if (String(name).trim() === '') return res.status(400).json({ error: 'ชื่อห้ามว่าง' });
      if (String(name).trim().length > 80) return res.status(400).json({ error: 'ชื่อยาวเกินไป (สูงสุด 80 ตัวอักษร)' });
      nameTrim = String(name).trim();
      normalized = normalizeName(nameTrim);
      slug = slugify(nameTrim);

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
      try {
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
      } catch (e) { /* noop */ }
    }
    res.status(500).json({ error: 'ไม่สามารถอัปเดตข้อมูลได้' });
  }
};

// ✅ ARCHIVE — set active=false (block if referenced)
const archiveProductProfile = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productProfile.findUnique({ where: { id }, select: { id: true, active: true, productTypeId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบลักษณะสินค้าที่ต้องการปิดการใช้งาน' });

    const pt = await getProductTypeGuardInfo(current.productTypeId);
    if (pt?.category?.isSystem) return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้ปิดการใช้งานข้อมูลย่อย' });

    const usedByTemplate = await prisma.productTemplate.findFirst({ where: { productProfileId: id } });
    if (usedByTemplate) {
      return res.status(409).json({ error: 'HAS_REFERENCES', message: 'มีการอ้างอิงอยู่ (productTemplate)' });
    }
    const usedByProduct = await prisma.product.findFirst({ where: { productProfileId: id } });
    if (usedByProduct) {
      return res.status(409).json({ error: 'HAS_REFERENCES', message: 'มีการอ้างอิงอยู่ (product)' });
    }

    if (current.active === false) return res.json({ message: 'ลักษณะสินค้านี้ถูกปิดการใช้งานอยู่แล้ว', id });

    await prisma.productProfile.update({ where: { id }, data: { active: false } });
    return res.json({ message: 'ปิดการใช้งานลักษณะสินค้าเรียบร้อย', id });
  } catch (err) {
    console.error('❌ ARCHIVE ProductProfile Failed:', err);
    if (err?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบลักษณะสินค้าที่ต้องการปิดการใช้งาน' });
    return res.status(500).json({ error: 'ไม่สามารถปิดการใช้งานลักษณะสินค้าได้' });
  }
};

// ✅ RESTORE — set active=true
const restoreProductProfile = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productProfile.findUnique({ where: { id }, select: { id: true, active: true, productTypeId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบลักษณะสินค้าที่ต้องการกู้คืน' });

    const pt = await getProductTypeGuardInfo(current.productTypeId);
    if (pt?.active === false || pt?.category?.active === false) {
      return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'ประเภทสินค้า/หมวดหมู่ถูกปิดการใช้งานอยู่ กรุณากู้คืนก่อน' });
    }

    if (current.active === true) return res.json({ message: 'ลักษณะสินค้านี้อยู่ในสถานะใช้งานแล้ว', id });

    await prisma.productProfile.update({ where: { id }, data: { active: true } });
    return res.json({ message: 'กู้คืนลักษณะสินค้าเรียบร้อย', id });
  } catch (err) {
    console.error('❌ RESTORE ProductProfile Failed:', err);
    if (err?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบลักษณะสินค้าที่ต้องการกู้คืน' });
    return res.status(500).json({ error: 'ไม่สามารถกู้คืนลักษณะสินค้าได้' });
  }
};

// (ยังคงไว้เพื่อ Backward-Compatible หากส่วนอื่นในระบบยังเรียกใช้อยู่)
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

// ✅ DROPDOWNS — return only active=true (optional filter by productTypeId/categoryId)
const getProductProfileDropdowns = async (req, res) => {
  try {
    const { productTypeId, categoryId } = req.query || {};
    const where = omitUndefined({
      active: true,
      ...(toInt(productTypeId) ? { productTypeId: toInt(productTypeId) } : {}),
      ...(toInt(categoryId) ? { productType: { categoryId: toInt(categoryId) } } : {}),
    });

    const profiles = await prisma.productProfile.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    res.json(profiles);
  } catch (err) {
    console.error('❌ [Dropdown ProductProfile] Error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึง dropdown ได้' });
  }
};

module.exports = {
  createProductProfile,
  getAllProductProfiles,
  getProfilesByCategory,
  getProductProfileById,
  updateProductProfile,
  archiveProductProfile,
  restoreProductProfile,
  getProductProfileDropdowns,
  deleteProductProfile, // ไว้เพื่อความเข้ากันได้ ยกเลิกรถเรียกใช้ที่ routes แล้ว
};



