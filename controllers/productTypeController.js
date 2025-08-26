// productTypeController — Prisma singleton, validations, safer errors

const { prisma, Prisma } = require('../lib/prisma');

// helpers
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : parseInt(v, 10));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// ✅ GET: โหลดประเภทสินค้าทั้งหมด (รองรับค้นหา/กรอง)
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

// ✅ GET: รายการเดียว
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

// ✅ POST: สร้างประเภทสินค้าใหม่
const createProductType = async (req, res) => {
  try {
    const { name, categoryId } = req.body || {};

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ error: 'กรุณาระบุชื่อประเภทสินค้า' });
    }
    if (!toInt(categoryId)) {
      return res.status(400).json({ error: 'กรุณาระบุหมวดหมู่สินค้า (categoryId) ให้ถูกต้อง' });
    }

    // ตรวจสอบว่า category มีอยู่จริง
    const cat = await prisma.category.findUnique({ where: { id: toInt(categoryId) }, select: { id: true } });
    if (!cat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่สินค้า (category)' });

    // 🔍 ตรวจสอบชื่อซ้ำ (รองรับทั้งกรณีมี unique index หรือไม่)
    const existing = await prisma.productType.findFirst({ where: { name: String(name).trim() } });
    if (existing) {
      return res.status(409).json({ error: 'ชื่อประเภทสินค้านี้มีอยู่ในระบบแล้ว' });
    }

    const newType = await prisma.productType.create({
      data: {
        name: String(name).trim(),
        categoryId: toInt(categoryId),
      },
      include: { category: true },
    });

    res.status(201).json(newType);
  } catch (err) {
    console.error('❌ CREATE ProductType Failed:', err);
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'ชื่อประเภทสินค้าซ้ำ (unique constraint)' });
    }
    res.status(500).json({ error: 'ไม่สามารถเพิ่มประเภทสินค้าได้' });
  }
};

// ✅ PATCH: แก้ไขประเภทสินค้า
const updateProductType = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const { name, categoryId } = req.body || {};

    if (categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: toInt(categoryId) }, select: { id: true } });
      if (!cat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่สินค้า (category)' });
    }

    const data = omitUndefined({
      name: name !== undefined ? String(name).trim() : undefined,
      categoryId: toInt(categoryId),
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
    if (err?.code === 'P2002') return res.status(409).json({ error: 'ชื่อประเภทสินค้าซ้ำ (unique constraint)' });
    res.status(500).json({ error: 'ไม่สามารถแก้ไขประเภทสินค้าได้' });
  }
};

// ✅ DELETE: ลบประเภทสินค้า (กันลบถ้ามีการอ้างอิง)
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

// ✅ GET: dropdowns
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
