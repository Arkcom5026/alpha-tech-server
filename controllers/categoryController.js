// controllers/categoryController.js — Option A: full FE/BE contract
// - รับ q หรือ search
// - รองรับ includeInactive, page, limit
// - คืน { items, total, page, limit }
// - กัน cache 304 ด้วย Cache-Control: no-store
// - คง logic archive/restore + isSystem guards เดิม

const { prisma, Prisma } = require('../lib/prisma');

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// GET /categories
const getAllCategories = async (req, res) => {
  try {
    const q = ((req.query?.q ?? req.query?.search) || '').toString().trim();
    const page = Number(req.query?.page) > 0 ? Number(req.query.page) : 1;
    const limit = Number(req.query?.limit) > 0 ? Number(req.query.limit) : 20;
    const includeInactive = String(req.query?.includeInactive).toLowerCase() === 'true';

    const where = {
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      ...(includeInactive ? {} : { active: true }),
    };

    const [total, items] = await Promise.all([
      prisma.category.count({ where }),
      prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({ items, total, page, limit });
  } catch (error) {
    console.error('❌ [getAllCategories] error:', error);
    res.status(500).json({ message: 'ไม่สามารถโหลดหมวดหมู่ได้' });
  }
};

// GET /categories/:id
const getCategoryById = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ message: 'ไม่พบหมวดหมู่' });

    res.json(category);
  } catch (error) {
    console.error('❌ [getCategoryById] error:', error);
    res.status(500).json({ message: 'ไม่สามารถดึงหมวดหมู่ได้' });
  }
};

// POST /categories
const createCategory = async (req, res) => {
  try {
    const name = (req.body?.name || '').toString().trim();
    if (!name) {
      return res.status(400).json({ message: 'กรุณาระบุชื่อหมวดหมู่' });
    }

    const isSystem = Boolean(req.body?.isSystem) === true;

    const created = await prisma.category.create({ data: { name, active: true, isSystem } });
    res.status(201).json(created);
  } catch (error) {
    console.error('❌ [createCategory] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'ชื่อหมวดหมู่ซ้ำ (unique constraint)' });
    }
    res.status(500).json({ message: 'ไม่สามารถสร้างหมวดหมู่ได้' });
  }
};

// PATCH /categories/:id
const updateCategory = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const name = (req.body?.name || '').toString().trim();
    if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อหมวดหมู่' });

    const current = await prisma.category.findUnique({ where: { id }, select: { id: true, isSystem: true } });
    if (!current) return res.status(404).json({ message: 'ไม่พบหมวดหมู่ที่ต้องการแก้ไข' });
    if (current.isSystem) return res.status(403).json({ message: 'หมวดระบบ (isSystem) ไม่อนุญาตให้แก้ไข' });

    const updated = await prisma.category.update({
      where: { id },
      data: { name },
    });

    res.json(updated);
  } catch (error) {
    console.error('❌ [updateCategory] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'ไม่พบหมวดหมู่ที่ต้องการแก้ไข' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'ชื่อหมวดหมู่ซ้ำ (unique constraint)' });
    }
    res.status(500).json({ message: 'ไม่สามารถแก้ไขหมวดหมู่ได้' });
  }
};

// 🔐 PATCH /categories/:id/archive — soft delete (active=false)
const archiveCategory = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const current = await prisma.category.findUnique({ where: { id }, select: { id: true, active: true, isSystem: true } });
    if (!current) return res.status(404).json({ message: 'ไม่พบหมวดหมู่ที่ต้องการปิดการใช้งาน' });
    if (current.isSystem) return res.status(403).json({ message: 'หมวดระบบ (isSystem) ไม่อนุญาตให้ปิดการใช้งาน' });

    const usedByType = await prisma.productType.findFirst({ where: { categoryId: id }, select: { id: true, name: true } });
    if (usedByType) {
      return res.status(409).json({
        error: 'HAS_REFERENCES',
        message: 'ไม่สามารถปิดการใช้งานได้ เพราะมีประเภทสินค้า (ProductType) อ้างอิงอยู่',
        conflict: usedByType,
      });
    }

    if (current.active === false) return res.json({ message: 'หมวดหมู่นี้ถูกปิดการใช้งานอยู่แล้ว', id });

    await prisma.category.update({ where: { id }, data: { active: false } });
    return res.json({ message: 'ปิดการใช้งานหมวดหมู่เรียบร้อย', id });
  } catch (error) {
    console.error('❌ [archiveCategory] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'ไม่พบหมวดหมู่ที่ต้องการปิดการใช้งาน' });
    }
    return res.status(500).json({ message: 'ไม่สามารถปิดการใช้งานหมวดหมู่ได้' });
  }
};

// 🔐 PATCH /categories/:id/restore — active=true
const restoreCategory = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const current = await prisma.category.findUnique({ where: { id }, select: { id: true, active: true } });
    if (!current) return res.status(404).json({ message: 'ไม่พบหมวดหมู่ที่ต้องการกู้คืน' });

    if (current.active === true) return res.json({ message: 'หมวดหมู่นี้อยู่ในสถานะใช้งานแล้ว', id });

    await prisma.category.update({ where: { id }, data: { active: true } });
    return res.json({ message: 'กู้คืนหมวดหมู่เรียบร้อย', id });
  } catch (error) {
    console.error('❌ [restoreCategory] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'ไม่พบหมวดหมู่ที่ต้องการกู้คืน' });
    }
    return res.status(500).json({ message: 'ไม่สามารถกู้คืนหมวดหมู่ได้' });
  }
};

// GET /categories/dropdowns — return only active=true
const getCategoryDropdowns = async (req, res) => {
  try {
    const dropdowns = await prisma.category.findMany({
      where: { active: true },
      select: { id: true, name: true, active: true, isSystem: true },
      orderBy: { name: 'asc' },
    });
    res.set('Cache-Control', 'no-store');
    res.json(dropdowns);
  } catch (error) {
    console.error('❌ [getCategoryDropdowns] error:', error);
    res.status(500).json({ message: 'ไม่สามารถดึง dropdown หมวดหมู่ได้' });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  archiveCategory,
  restoreCategory,
  getCategoryDropdowns,
};
