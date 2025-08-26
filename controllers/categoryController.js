// controllers/categoryController.js — Prisma singleton + validations + safer Prisma errors

const { prisma, Prisma } = require('../lib/prisma');

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// GET /categories
const getAllCategories = async (req, res) => {
  try {
    const q = (req.query?.q || '').toString().trim();

    const categories = await prisma.category.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
    res.json(categories);
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

    const created = await prisma.category.create({ data: { name } });
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

// DELETE /categories/:id
const deleteCategory = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    await prisma.category.delete({ where: { id } });
    res.json({ message: 'ลบหมวดหมู่เรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ [deleteCategory] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'ไม่พบหมวดหมู่ที่ต้องการลบ' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(409).json({ message: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' });
    }
    res.status(500).json({ message: 'ไม่สามารถลบหมวดหมู่ได้' });
  }
};

// GET /categories/dropdowns
const getCategoryDropdowns = async (req, res) => {
  try {
    const dropdowns = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
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
  deleteCategory,
  getCategoryDropdowns,
};
