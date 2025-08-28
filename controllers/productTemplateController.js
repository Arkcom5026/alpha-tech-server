// productTemplateController.js — Guards: normalize + unique-by-parent (productProfileId), safer P2002 detail

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

// ✅ GET /product-templates — list with filters/mapping (คงรูปแบบเดิม)
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

    // ensure references exist
    const [pf, unit] = await Promise.all([
      prisma.productProfile.findUnique({ where: { id: productProfileIdInt }, select: { id: true } }),
      prisma.unit.findUnique({ where: { id: unitIdInt }, select: { id: true } }),
    ]);
    if (!pf) return res.status(404).json({ error: 'ไม่พบ productProfile' });
    if (!unit) return res.status(404).json({ error: 'ไม่พบหน่วยนับ (unit)' });

    const nameTrim = String(name).trim();
    if (!nameTrim) return res.status(400).json({ error: 'ชื่อห้ามว่าง' });
    const normalized = normalizeName(nameTrim);
    const slug = slugify(nameTrim);

    // proactive duplicate check under parent
    const dupe = await findDuplicateTemplate({ productProfileId: $1, normalizedName: $2, slug });
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
      const productProfileIdInt = toInt(req.body?.productProfileId);
      $1
      const slug = req.body?.slug || slugify(String(req.body?.name || ''));
      const dupe = await findDuplicateTemplate({ productProfileId: $1, normalizedName: $2, slug });
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม',
        level: 'template',
        parentField: 'productProfileId',
        parentId: productProfileIdInt ?? null,
        conflict: dupe || null,
      });
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

    // validate provided refs
    const productProfileIdInt = toInt(productProfileId);
    if (productProfileId !== undefined) {
      if (!productProfileIdInt) return res.status(400).json({ error: 'productProfileId ไม่ถูกต้อง' });
      const pf = await prisma.productProfile.findUnique({ where: { id: productProfileIdInt }, select: { id: true } });
      if (!pf) return res.status(404).json({ error: 'ไม่พบ productProfile' });
    }
    const unitIdInt = toInt(unitId);
    if (unitId !== undefined) {
      if (!unitIdInt) return res.status(400).json({ error: 'unitId ไม่ถูกต้อง' });
      const un = await prisma.unit.findUnique({ where: { id: unitIdInt }, select: { id: true } });
      if (!un) return res.status(404).json({ error: 'ไม่พบหน่วยนับ (unit)' });
    }

    // current row for fallback parent
    const current = await prisma.productTemplate.findUnique({ where: { id }, select: { id: true, productProfileId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบ template ที่ต้องการอัปเดต' });

    const targetProductProfileId = productProfileIdInt ?? current.productProfileId;

    // prepare name changes & proactive duplicate check
    let nameTrim, normalized, slug;
    if (name !== undefined) {
      if (String(name).trim() === '') return res.status(400).json({ error: 'ชื่อห้ามว่าง' });
      nameTrim = String(name).trim();
      normalized = normalizeName(nameTrim);
      slug = slugify(nameTrim);

      const dupe = await findDuplicateTemplate({ productProfileId: $1, normalizedName: $2, slug });
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
      const id = toInt(req.params.id);
      const current = await prisma.productTemplate.findUnique({ where: { id }, select: { productProfileId: true } });
      const targetProductProfileId = toInt(req.body?.productProfileId) ?? current?.productProfileId;
      $1
      const slug = req.body?.slug || slugify(String(req.body?.name || ''));
      const dupe = await findDuplicateTemplate({ productProfileId: $1, normalizedName: $2, slug });
      return res.status(409).json({
        error: 'DUPLICATE',
        message: 'พบรายการเดิม',
        level: 'template',
        parentField: 'productProfileId',
        parentId: targetProductProfileId ?? null,
        conflict: dupe || null,
      });
    }
    res.status(500).json({ error: 'Failed to update product template' });
  }
};

// ✅ DELETE /product-templates/:id — block when referenced by product/stock
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

module.exports = {
  getAllProductTemplates,
  createProductTemplate,
  updateProductTemplate,
  getProductTemplateById,
  deleteProductTemplate,
};
