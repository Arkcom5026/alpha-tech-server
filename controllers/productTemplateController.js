// productTemplateController.js — Prisma singleton, safer handlers, validations

const { prisma, Prisma } = require('../lib/prisma');

// helpers
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : parseInt(v, 10));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// GET /product-templates
const getAllProductTemplates = async (req, res) => {
  try {
    const { q, productProfileId, productTypeId, categoryId } = req.query || {};

    const where = omitUndefined({
      ...(toInt(productProfileId) ? { productProfileId: toInt(productProfileId) } : {}),
      ...(toInt(productTypeId)
        ? { productProfile: { productTypeId: toInt(productTypeId) } }
        : {}),
      ...(toInt(categoryId)
        ? { productProfile: { productType: { categoryId: toInt(categoryId) } } }
        : {}),
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
        productProfile: {
          include: {
            productType: { include: { category: true } },
          },
        },
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

// POST /product-templates
const createProductTemplate = async (req, res) => {
  try {
    const { name, productProfileId, unitId } = req.body || {};

    if (!name || !toInt(productProfileId) || !toInt(unitId)) {
      return res.status(400).json({ error: 'ต้องระบุ name, productProfileId และ unitId ให้ถูกต้อง' });
    }

    // ensure references exist
    const [pf, unit] = await Promise.all([
      prisma.productProfile.findUnique({ where: { id: toInt(productProfileId) }, select: { id: true } }),
      prisma.unit.findUnique({ where: { id: toInt(unitId) }, select: { id: true } }),
    ]);
    if (!pf) return res.status(404).json({ error: 'ไม่พบ productProfile' });
    if (!unit) return res.status(404).json({ error: 'ไม่พบหน่วยนับ (unit)' });

    const newTemplate = await prisma.productTemplate.create({
      data: {
        name: String(name).trim(),
        unitId: toInt(unitId),
        productProfileId: toInt(productProfileId),
      },
      include: {
        unit: true,
        productProfile: { include: { productType: { include: { category: true } } } },
      },
    });

    res.status(201).json(newTemplate);
  } catch (error) {
    console.error('❌ createProductTemplate error:', error);
    if (error?.code === 'P2002') {
      return res.status(409).json({ error: 'ชื่อ template ซ้ำ (unique constraint)' });
    }
    res.status(500).json({ error: 'Failed to create template' });
  }
};

// PATCH /product-templates/:id
const updateProductTemplate = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const { name, productProfileId, unitId } = req.body || {};

    if (productProfileId) {
      const pf = await prisma.productProfile.findUnique({ where: { id: toInt(productProfileId) }, select: { id: true } });
      if (!pf) return res.status(404).json({ error: 'ไม่พบ productProfile' });
    }
    if (unitId) {
      const un = await prisma.unit.findUnique({ where: { id: toInt(unitId) }, select: { id: true } });
      if (!un) return res.status(404).json({ error: 'ไม่พบหน่วยนับ (unit)' });
    }

    const data = omitUndefined({
      name: name !== undefined ? String(name).trim() : undefined,
      productProfileId: toInt(productProfileId),
      unitId: toInt(unitId),
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
    if (error?.code === 'P2002') return res.status(409).json({ error: 'ชื่อ template ซ้ำ (unique constraint)' });
    res.status(500).json({ error: 'Failed to update product template' });
  }
};

// DELETE /product-templates/:id
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

// GET /product-templates/:id
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
