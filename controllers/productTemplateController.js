// productTemplateController.js — Guards: normalize + unique-by-parent (productProfileId), archive/restore, safer P2002

const { prisma } = require('../lib/prisma');

// ---------- helpers ----------
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// Inline normalizer (align with other controllers)
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

// ---------- parent guard ----------
async function getProfileGuardInfo(productProfileId) {
  if (!productProfileId) return null;
  return prisma.productProfile.findUnique({
    where: { id: productProfileId },
    select: {
      id: true,
      active: true,
      productType: {
        select: {
          id: true,
          active: true,
          category: { select: { id: true, active: true, isSystem: true } },
        },
      },
    },
  });
}

// ---------- queries ----------
async function findDuplicateTemplate({ productProfileId, normalizedName, slug }) {
  if (!productProfileId || (!normalizedName && !slug)) return null;
  return prisma.productTemplate.findFirst({
    where: {
      productProfileId,
      OR: [
        ...(normalizedName ? [{ normalizedName }] : []),
        ...(slug ? [{ slug }] : []),
      ],
    },
    select: { id: true, name: true, slug: true, normalizedName: true, pathCached: true },
  });
}

// ✅ GET /product-templates — list (คงรูปแบบเดิม)
const getAllProductTemplates = async (req, res) => {
  try {
    const { q, productProfileId, productTypeId, categoryId } = req.query || {};

    const where = omitUndefined({
      ...(toInt(productProfileId) ? { productProfileId: toInt(productProfileId) } : {}),
      ...(toInt(productTypeId) ? { productProfile: { productTypeId: toInt(productTypeId) } } : {}),
      ...(toInt(categoryId) ? { productProfile: { productType: { categoryId: toInt(categoryId) } } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: String(q), mode: 'insensitive' } },
              { productProfile: { name: { contains: String(q), mode: 'insensitive' } } },
            ],
          }
        : {}),
    });

    const templates = await prisma.productTemplate.findMany({
      where,
      include: {
        productProfile: { include: { productType: { include: { category: true } } } },
        unit: true,
      },
      orderBy: [{ id: 'desc' }],
    });

    const mapped = templates.map((t) => ({
      id: t.id,
      name: t.name,
      unitId: t.unitId,
      unitName: t.unit?.name ?? '-',
      productProfileName: t.productProfile?.name ?? '-',
      productProfileId: t.productProfile?.id,
      productTypeId: t.productProfile?.productType?.id,
      categoryId: t.productProfile?.productType?.category?.id,
    }));

    res.json(mapped);
  } catch (error) {
    console.error('❌ getAllProductTemplates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ POST /product-templates — create with normalize + unique guard (under productProfileId)
const createProductTemplate = async (req, res) => {
  try {
    const { name, productProfileId, unitId } = req.body || {};

    if (!name || !toInt(productProfileId) || !toInt(unitId)) {
      return res.status(400).json({ error: 'ต้องระบุ name, productProfileId และ unitId ให้ถูกต้อง' });
    }

    const productProfileIdInt = toInt(productProfileId);
    const unitIdInt = toInt(unitId);

    const [pfGuard, unit] = await Promise.all([
      getProfileGuardInfo(productProfileIdInt),
      prisma.unit.findUnique({ where: { id: unitIdInt }, select: { id: true } }),
    ]);

    if (!pfGuard) return res.status(404).json({ error: 'ไม่พบ productProfile' });
    if (!unit) return res.status(404).json({ error: 'ไม่พบหน่วยนับ (unit)' });

    // parent guards
    if (pfGuard.productType?.category?.isSystem) {
      return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้เพิ่มข้อมูลย่อย' });
    }
    if (
      pfGuard.active === false ||
      pfGuard.productType?.active === false ||
      pfGuard.productType?.category?.active === false
    ) {
      return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'โปรไฟล์/ประเภท/หมวดหมู่ถูกปิดการใช้งานอยู่ กรุณากู้คืนก่อน' });
    }

    const nameTrim = String(name).trim();
    if (!nameTrim) return res.status(400).json({ error: 'ชื่อห้ามว่าง' });
    const normalized = normalizeName(nameTrim);
    const slug = slugify(nameTrim);

    const dupe = await findDuplicateTemplate({ productProfileId: productProfileIdInt, normalizedName: normalized, slug });
    if (dupe) {
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม',
        level: 'template',
        parentField: 'productProfileId',
        parentId: productProfileIdInt,
        conflict: dupe,
      });
    }

    const created = await prisma.productTemplate.create({
      data: {
        name: nameTrim,
        normalizedName: normalized,
        slug,
        unitId: unitIdInt,
        productProfileId: productProfileIdInt,
        active: true,
      },
      include: {
        unit: true,
        productProfile: { include: { productType: { include: { category: true } } } },
      },
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('❌ createProductTemplate error:', error);
    if (error?.code === 'P2002') {
      try {
        const productProfileIdInt = toInt(req.body?.productProfileId);
        const nameTrim = String(req.body?.name || '').trim();
        const normalized = req.body?.normalizedName || normalizeName(nameTrim);
        const slug = req.body?.slug || slugify(nameTrim);
        const dupe = await findDuplicateTemplate({ productProfileId: productProfileIdInt, normalizedName: normalized, slug });
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม',
          level: 'template',
          parentField: 'productProfileId',
          parentId: productProfileIdInt ?? null,
          conflict: dupe || null,
        });
      } catch (_) {}
    }
    res.status(500).json({ error: 'Failed to create template' });
  }
};

// ✅ PATCH /product-templates/:id — update with normalize + unique guard under target productProfileId
const updateProductTemplate = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const { name, productProfileId, unitId } = req.body || {};

    // current row + its parent for guard
    const current = await prisma.productTemplate.findUnique({
      where: { id },
      select: { id: true, productProfileId: true },
    });
    if (!current) return res.status(404).json({ error: 'ไม่พบ template ที่ต้องการอัปเดต' });

    const currentGuard = await getProfileGuardInfo(current.productProfileId);
    if (currentGuard?.productType?.category?.isSystem) {
      return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้แก้ไขข้อมูลย่อย' });
    }

    // validate provided refs
    const productProfileIdInt = toInt(productProfileId);
    const unitIdInt = toInt(unitId);

    if (productProfileId !== undefined) {
      if (!productProfileIdInt) return res.status(400).json({ error: 'productProfileId ไม่ถูกต้อง' });
      const targetGuard = await getProfileGuardInfo(productProfileIdInt);
      if (!targetGuard) return res.status(404).json({ error: 'ไม่พบ productProfile' });
      if (targetGuard.productType?.category?.isSystem) {
        return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้ย้าย/เพิ่มข้อมูลย่อย' });
      }
      if (
        targetGuard.active === false ||
        targetGuard.productType?.active === false ||
        targetGuard.productType?.category?.active === false
      ) {
        return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'โปรไฟล์/ประเภท/หมวดปลายทางถูกปิดการใช้งานอยู่ กรุณากู้คืนก่อน' });
      }
    }

    if (unitId !== undefined) {
      if (!unitIdInt) return res.status(400).json({ error: 'unitId ไม่ถูกต้อง' });
      const un = await prisma.unit.findUnique({ where: { id: unitIdInt }, select: { id: true } });
      if (!un) return res.status(404).json({ error: 'ไม่พบหน่วยนับ (unit)' });
    }

    const targetProductProfileId = productProfileIdInt ?? current.productProfileId;

    // prepare name changes & proactive duplicate check
    let nameTrim, normalized, slug;
    if (name !== undefined) {
      if (String(name).trim() === '') return res.status(400).json({ error: 'ชื่อห้ามว่าง' });
      nameTrim = String(name).trim();
      normalized = normalizeName(nameTrim);
      slug = slugify(nameTrim);

      const dupe = await findDuplicateTemplate({ productProfileId: targetProductProfileId, normalizedName: normalized, slug });
      if (dupe && dupe.id !== id) {
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม',
          level: 'template',
          parentField: 'productProfileId',
          parentId: targetProductProfileId,
          conflict: dupe,
        });
      }
    }

    const data = omitUndefined({
      name: nameTrim,
      normalizedName: normalized,
      slug,
      productProfileId: targetProductProfileId !== current.productProfileId ? targetProductProfileId : undefined,
      unitId: unitIdInt,
    });

    const updated = await prisma.productTemplate.update({
      where: { id },
      data,
      include: {
        unit: true,
        productProfile: { include: { productType: { include: { category: true } } } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('❌ updateProductTemplate error:', error);
    if (error?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบ template ที่ต้องการอัปเดต' });
    if (error?.code === 'P2002') {
      try {
        const id = toInt(req.params.id);
        const current = await prisma.productTemplate.findUnique({ where: { id }, select: { productProfileId: true } });
        const targetProductProfileId = toInt(req.body?.productProfileId) ?? current?.productProfileId;
        const nameTrim = String(req.body?.name || '').trim();
        const normalized = req.body?.normalizedName || normalizeName(nameTrim);
        const slug = req.body?.slug || slugify(nameTrim);
        const dupe = await findDuplicateTemplate({ productProfileId: targetProductProfileId, normalizedName: normalized, slug });
        return res.status(409).json({
          error: 'DUPLICATE',
          message: 'พบรายการเดิม',
          level: 'template',
          parentField: 'productProfileId',
          parentId: targetProductProfileId ?? null,
          conflict: dupe || null,
        });
      } catch (_) {}
    }
    res.status(500).json({ error: 'Failed to update product template' });
  }
};

// ✅ ARCHIVE — set active=false (block if referenced by product)
const archiveProductTemplate = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productTemplate.findUnique({ where: { id }, select: { id: true, active: true, productProfileId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบเทมเพลตสินค้าที่ต้องการปิดการใช้งาน' });

    const guard = await getProfileGuardInfo(current.productProfileId);
    if (guard?.productType?.category?.isSystem) {
      return res.status(403).json({ error: 'หมวดระบบ (isSystem) ไม่อนุญาตให้ปิดการใช้งานข้อมูลย่อย' });
    }

    const usedByProduct = await prisma.product.findFirst({ where: { templateId: id } });
    if (usedByProduct) {
      return res.status(409).json({ error: 'HAS_REFERENCES', message: 'มีการอ้างอิงอยู่ (product)' });
    }

    if (current.active === false) return res.json({ message: 'เทมเพลตนี้ถูกปิดการใช้งานอยู่แล้ว', id });

    await prisma.productTemplate.update({ where: { id }, data: { active: false } });
    return res.json({ message: 'ปิดการใช้งานเทมเพลตสินค้าเรียบร้อย', id });
  } catch (error) {
    console.error('❌ ARCHIVE ProductTemplate Failed:', error);
    if (error?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบเทมเพลตสินค้าที่ต้องการปิดการใช้งาน' });
    return res.status(500).json({ error: 'ไม่สามารถปิดการใช้งานเทมเพลตสินค้าได้' });
  }
};

// ✅ RESTORE — set active=true
const restoreProductTemplate = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productTemplate.findUnique({ where: { id }, select: { id: true, active: true, productProfileId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบเทมเพลตสินค้าที่ต้องการกู้คืน' });

    const guard = await getProfileGuardInfo(current.productProfileId);
    if (
      guard?.active === false ||
      guard?.productType?.active === false ||
      guard?.productType?.category?.active === false
    ) {
      return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'โปรไฟล์/ประเภท/หมวดหมู่ถูกปิดการใช้งานอยู่ กรุณากู้คืนก่อน' });
    }

    if (current.active === true) return res.json({ message: 'เทมเพลตนี้อยู่ในสถานะใช้งานแล้ว', id });

    await prisma.productTemplate.update({ where: { id }, data: { active: true } });
    return res.json({ message: 'กู้คืนเทมเพลตสินค้าเรียบร้อย', id });
  } catch (error) {
    console.error('❌ RESTORE ProductTemplate Failed:', error);
    if (error?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบเทมเพลตสินค้าที่ต้องการกู้คืน' });
    return res.status(500).json({ error: 'ไม่สามารถกู้คืนเทมเพลตสินค้าได้' });
  }
};

// ✅ GET /product-templates/:id — single
const getProductTemplateById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const template = await prisma.productTemplate.findUnique({
      where: { id },
      include: {
        unit: true,
        productProfile: { include: { productType: { include: { category: true } } } },
      },
    });

    if (!template) return res.status(404).json({ error: 'ไม่พบข้อมูล' });

    res.json(template);
  } catch (error) {
    console.error('❌ getProductTemplateById error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลได้' });
  }
};

// (ยังคงไว้เพื่อ Backward-Compatible หากส่วนอื่นในระบบยังเรียกใช้อยู่)
const deleteProductTemplate = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const usedInProduct = await prisma.product.findFirst({ where: { templateId: id } });
    const usedInStock = await prisma.stockItem.findFirst({ where: { product: { templateId: id } } });
    if (usedInProduct || usedInStock) {
      return res.status(409).json({ error: 'ไม่สามารถลบได้ เพราะมีการใช้งานแล้ว' });
    }

    await prisma.productTemplate.delete({ where: { id } });
    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('❌ deleteProductTemplate error:', error);
    if (error?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบ template ที่ต้องการลบ' });
    if (error?.code === 'P2003') return res.status(409).json({ error: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' });
    res.status(500).json({ error: 'Failed to delete template' });
  }
};

// ✅ DROPDOWNS — return only active=true (optional filter by productProfileId/productTypeId/categoryId)
const getProductTemplateDropdowns = async (req, res) => {
  try {
    const { productProfileId, productTypeId, categoryId } = req.query || {};
    const where = omitUndefined({
      active: true,
      ...(toInt(productProfileId) ? { productProfileId: toInt(productProfileId) } : {}),
      ...(toInt(productTypeId) ? { productProfile: { productTypeId: toInt(productTypeId) } } : {}),
      ...(toInt(categoryId) ? { productProfile: { productType: { categoryId: toInt(categoryId) } } } : {}),
    });

    const templates = await prisma.productTemplate.findMany({
      where,
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    res.json(templates);
  } catch (error) {
    console.error('❌ [Dropdown ProductTemplate] Error:', error);
    res.status(500).json({ error: 'ไม่สามารถดึง dropdown เทมเพลตได้' });
  }
};

module.exports = {
  getAllProductTemplates,
  createProductTemplate,
  updateProductTemplate,
  archiveProductTemplate,
  restoreProductTemplate,
  getProductTemplateById,
  getProductTemplateDropdowns,
  deleteProductTemplate, // ไว้เพื่อความเข้ากันได้ ถึงแม้ routes จะไม่ใช้แล้ว
};
