// productProfileController.js — Production Baseline (BestLine): ProductProfile is a reusable group (NOT tied to Category/ProductType)
// Guards: normalize + global unique (normalizedName/slug), safe P2002 detail

const { prisma } = require('../lib/prisma');
const MAX_LIMIT = 100;

// ---------- helpers ----------
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// Inline normalizer
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
  return base
    .replace(/[.]/g, '')
    .replace(/[ ]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------- queries ----------
async function findDuplicateProfile({ normalizedName, slug, excludeId }) {
  if (!normalizedName && !slug) return null;
  return prisma.productProfile.findFirst({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        ...(normalizedName ? [{ normalizedName }] : []),
        ...(slug ? [{ slug }] : []),
      ],
    },
    select: { id: true, name: true, slug: true, normalizedName: true },
  });
}

// ✅ POST /product-profiles — create with normalize + global unique guard
const createProductProfile = async (req, res) => {
  try {
    const { name, description } = req.body || {};

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ error: 'ต้องระบุ name ที่ถูกต้อง' });
    }
    if (String(name).trim().length > 80) {
      return res.status(400).json({ error: 'ชื่อยาวเกินไป (สูงสุด 80 ตัวอักษร)' });
    }

    const nameTrim = String(name).trim();
    const normalized = normalizeName(nameTrim);
    const slug = slugify(nameTrim);

    const dupe = await findDuplicateProfile({ normalizedName: normalized, slug });
    if (dupe) {
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม',
        level: 'profile',
        conflict: dupe,
      });
    }

    const profile = await prisma.productProfile.create({
      data: {
        name: nameTrim,
        normalizedName: normalized,
        slug,
        description: description ? String(description) : null,
        active: true,
      },
    });

    res.status(201).json(profile);
  } catch (err) {
    console.error('❌ [Create ProductProfile] Error:', err);
    if (err && err.code === 'P2002') {
      try {
        const nameTrim = String(req.body?.name || '').trim();
        const normalized = req.body?.normalizedName || normalizeName(nameTrim);
        const slug = req.body?.slug || slugify(nameTrim);
        const dupe = await findDuplicateProfile({ normalizedName: normalized, slug });
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม',
          level: 'profile',
          conflict: dupe || null,
        });
      } catch (e) {
        // noop
      }
    }
    res.status(500).json({ error: 'ไม่สามารถสร้างข้อมูลได้' });
  }
};

// ✅ GET /product-profiles — list (q, includeInactive, page, limit)
const getAllProductProfiles = async (req, res) => {
  try {
    const { q, includeInactive, page: pageQ, limit: limitQ } = req.query || {};

    const pageRaw = Number(pageQ);
    const limitRaw = Number(limitQ);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 20;

    const where = omitUndefined({
      ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
      ...((String(includeInactive || '').toLowerCase() === 'true') ? {} : { active: true }),
    });

    const [total, items] = await Promise.all([
      prisma.productProfile.count({ where }),
      prisma.productProfile.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({ items, total, page, limit });
  } catch (err) {
    console.error('❌ [Fetch ProductProfiles] Error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลได้' });
  }
};

// ✅ GET /product-profiles/:id — single
const getProductProfileById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const profile = await prisma.productProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ error: 'ไม่พบข้อมูล' });

    res.json(profile);
  } catch (err) {
    console.error('❌ [Fetch by ID] Error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

// ✅ PATCH /product-profiles/:id — update with normalize + global unique guard
const updateProductProfile = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const { name, description } = req.body || {};

    const current = await prisma.productProfile.findUnique({ where: { id }, select: { id: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการอัปเดต' });

    let nameTrim, normalized, slug;
    if (name !== undefined) {
      if (String(name).trim() === '') return res.status(400).json({ error: 'ชื่อห้ามว่าง' });
      if (String(name).trim().length > 80) return res.status(400).json({ error: 'ชื่อยาวเกินไป (สูงสุด 80 ตัวอักษร)' });

      nameTrim = String(name).trim();
      normalized = normalizeName(nameTrim);
      slug = slugify(nameTrim);

      const dupe = await findDuplicateProfile({ normalizedName: normalized, slug, excludeId: id });
      if (dupe) {
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม',
          level: 'profile',
          conflict: dupe,
        });
      }
    }

    const data = omitUndefined({
      name: nameTrim,
      normalizedName: normalized,
      slug,
      description: description !== undefined ? (description ? String(description) : null) : undefined,
    });

    const updated = await prisma.productProfile.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('❌ [Update ProductProfile] Error:', err);
    if (err && err.code === 'P2025') return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการอัปเดต' });
    if (err && err.code === 'P2002') {
      try {
        const id = toInt(req.params.id);
        const nameTrim = String(req.body?.name || '').trim();
        const normalized = req.body?.normalizedName || normalizeName(nameTrim);
        const slug = req.body?.slug || slugify(nameTrim);
        const dupe = await findDuplicateProfile({ normalizedName: normalized, slug, excludeId: id });
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม',
          level: 'profile',
          conflict: dupe || null,
        });
      } catch (e) {
        // noop
      }
    }
    res.status(500).json({ error: 'ไม่สามารถอัปเดตข้อมูลได้' });
  }
};

// ✅ ARCHIVE — set active=false (block if referenced)
const archiveProductProfile = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productProfile.findUnique({ where: { id }, select: { id: true, active: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบโปรไฟล์สินค้าที่ต้องการปิดการใช้งาน' });

    const usedByTemplate = await prisma.productTemplate.findFirst({ where: { productProfileId: id } });
    if (usedByTemplate) {
      return res.status(409).json({ error: 'HAS_REFERENCES', message: 'มีการอ้างอิงอยู่ (productTemplate)' });
    }
    const usedByProduct = await prisma.product.findFirst({ where: { productProfileId: id } });
    if (usedByProduct) {
      return res.status(409).json({ error: 'HAS_REFERENCES', message: 'มีการอ้างอิงอยู่ (product)' });
    }

    if (current.active === false) return res.json({ message: 'โปรไฟล์นี้ถูกปิดการใช้งานอยู่แล้ว', id });

    await prisma.productProfile.update({ where: { id }, data: { active: false } });
    return res.json({ message: 'ปิดการใช้งานโปรไฟล์สินค้าเรียบร้อย', id });
  } catch (err) {
    console.error('❌ ARCHIVE ProductProfile Failed:', err);
    if (err?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบโปรไฟล์สินค้าที่ต้องการปิดการใช้งาน' });
    return res.status(500).json({ error: 'ไม่สามารถปิดการใช้งานโปรไฟล์สินค้าได้' });
  }
};

// ✅ RESTORE — set active=true
const restoreProductProfile = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productProfile.findUnique({ where: { id }, select: { id: true, active: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบโปรไฟล์สินค้าที่ต้องการกู้คืน' });

    if (current.active === true) return res.json({ message: 'โปรไฟล์นี้อยู่ในสถานะใช้งานแล้ว', id });

    await prisma.productProfile.update({ where: { id }, data: { active: true } });
    return res.json({ message: 'กู้คืนโปรไฟล์สินค้าเรียบร้อย', id });
  } catch (err) {
    console.error('❌ RESTORE ProductProfile Failed:', err);
    if (err?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบโปรไฟล์สินค้าที่ต้องการกู้คืน' });
    return res.status(500).json({ error: 'ไม่สามารถกู้คืนโปรไฟล์สินค้าได้' });
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

    const usedByProduct = await prisma.product.findFirst({ where: { productProfileId: id } });
    if (usedByProduct) {
      return res.status(409).json({ error: 'ลบไม่ได้ เพราะมีสินค้าที่อ้างอิงอยู่' });
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

// ✅ DROPDOWNS — return only active=true (no category/type filter)
const getProductProfileDropdowns = async (req, res) => {
  try {
    const profiles = await prisma.productProfile.findMany({
      where: { active: true },
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
  getProductProfileById,
  updateProductProfile,
  archiveProductProfile,
  restoreProductProfile,
  getProductProfileDropdowns,
  deleteProductProfile, // ไว้เพื่อความเข้ากันได้ (ยกเลิก route แล้ว)
};
