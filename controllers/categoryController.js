// ✅ controllers/categoryController.js
const prisma = require('../prisma/client');

const getAllCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({ orderBy: { id: 'asc' } });
    res.json(categories);
  } catch (err) {
    console.error('❌ โหลดหมวดหมู่ล้มเหลว:', err);
    res.status(500).json({ message: 'ไม่สามารถโหลดหมวดหมู่ได้' });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'กรุณาระบุชื่อหมวดหมู่' });
    }
    const created = await prisma.category.create({ data: { name: name.trim() } });
    res.status(201).json(created);
  } catch (err) {
    console.error('❌ สร้างหมวดหมู่ล้มเหลว:', err);
    res.status(500).json({ message: 'ไม่สามารถสร้างหมวดหมู่ได้' });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updated = await prisma.category.update({
      where: { id: Number(id) },
      data: { name },
    });
    res.json(updated);
  } catch (err) {
    console.error('❌ แก้ไขหมวดหมู่ล้มเหลว:', err);
    res.status(500).json({ message: 'ไม่สามารถแก้ไขหมวดหมู่ได้' });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await prisma.category.delete({
      where: { id: Number(id) },
    });
    res.json(deleted);
  } catch (err) {
    console.error('❌ ลบหมวดหมู่ล้มเหลว:', err);
    res.status(500).json({ message: 'ไม่สามารถลบหมวดหมู่ได้' });
  }
};

module.exports = {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};