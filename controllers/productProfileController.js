// productProfileController.js — unified Prisma import + safer handlers

const { prisma, Prisma } = require('../lib/prisma');

// helpers
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// POST /product-profiles
const createProductProfile = async (req, res) => {
  try {
    const { name, description, productTypeId } = req.body || {};

    if (!name || !toInt(productTypeId)) {
      return res.status(400).json({ error: 'ต้องระบุ name และ productTypeId ที่ถูกต้อง' });
    }

    // ensure productType exists
    const pt = await prisma.productType.findUnique({ where: { id: Number(productTypeId) }, select: { id: true } });
    if (!pt) return res.status(404).json({ error: 'ไม่พบประเภทสินค้า (productType)' });

    const profile = await prisma.productProfile.create({
      data: {
        name: String(name).trim(),
        description: description ? String(description) : null,
        productTypeId: Number(productTypeId),
      },
      include: {
        productType: { select: { id: true, name: true, categoryId: true } },
      },
    });

    res.status(201).json(profile);
  } catch (err) {
    console.error('❌ [Create ProductProfile] Error:', err);
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'ชื่อซ้ำ (unique constraint)' });
    }
    res.status(500).json({ error: 'ไม่สามารถสร้างข้อมูลได้' });
  }
};

// GET /product-profiles
const getAllProductProfiles = async (req, res) => {
  try {
    const { q, categoryId, productTypeId } = req.query || {};

    const where = omitUndefined({
      ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
      ...(toInt(productTypeId) ? { productTypeId: Number(productTypeId) } : {}),
      ...(toInt(categoryId)
        ? { productType: { categoryId: Number(categoryId) } }
        : {}),
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

// GET /product-profiles/category/:categoryId
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

// GET /product-profiles/:id
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

// PATCH /product-profiles/:id
const updateProductProfile = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const { name, description, productTypeId } = req.body || {};

    if (productTypeId) {
      const pt = await prisma.productType.findUnique({ where: { id: Number(productTypeId) }, select: { id: true } });
      if (!pt) return res.status(404).json({ error: 'ไม่พบประเภทสินค้า (productType)' });
    }

    const data = omitUndefined({
      name: name !== undefined ? String(name).trim() : undefined,
      description: description !== undefined ? (description ? String(description) : null) : undefined,
      productTypeId: toInt(productTypeId),
    });

    const updated = await prisma.productProfile.update({
      where: { id },
      data,
      include: { productType: { select: { id: true, name: true, categoryId: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error('❌ [Update ProductProfile] Error:', err);
    if (err?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการอัปเดต' });
    if (err?.code === 'P2002') return res.status(409).json({ error: 'ชื่อซ้ำ (unique constraint)' });
    res.status(500).json({ error: 'ไม่สามารถอัปเดตข้อมูลได้' });
  }
};

// DELETE /product-profiles/:id
const deleteProductProfile = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    await prisma.productProfile.delete({ where: { id } });
    res.json({ message: 'ลบข้อมูลเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('❌ [Delete ProductProfile] Error:', err);
    if (err?.code === 'P2025') return res.status(404).json({ error: 'ไม่พบข้อมูลที่ต้องการลบ' });
    if (err?.code === 'P2003') return res.status(409).json({ error: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' });
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
