// controllers/unitController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();


// ✅ GET /api/units
const getAllUnits = async (req, res) => {
  try {

    const units = await prisma.unit.findMany({ orderBy: { name: 'asc' } });
    res.json(units);
  } catch (error) {
    console.error('getAllUnits error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยนับ' });
  }
};

// ✅ GET /api/units/:id
const getUnitById = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await prisma.unit.findUnique({ where: { id: Number(id) } });
    if (!unit) return res.status(404).json({ error: 'ไม่พบหน่วยนับนี้' });
    res.json(unit);
  } catch (error) {
    console.error('getUnitById error:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยนับ' });
  }
};

// ✅ POST /api/units
const createUnit = async (req, res) => {
  try {
    
    const { name } = req.body;
    const newUnit = await prisma.unit.create({ data: { name } });
    res.status(201).json(newUnit);
  } catch (error) {
    console.error('createUnit error:', error);
    res.status(500).json({ error: 'ไม่สามารถสร้างหน่วยนับได้' });
  }
};

// ✅ PUT /api/units/:id
const updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedUnit = await prisma.unit.update({
      where: { id: Number(id) },
      data: { name },
    });
    res.json(updatedUnit);
  } catch (error) {
    console.error('updateUnit error:', error);
    res.status(500).json({ error: 'ไม่สามารถแก้ไขหน่วยนับได้' });
  }
};

// ✅ DELETE /api/units/:id
const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.unit.delete({ where: { id: Number(id) } });
    res.json({ message: 'ลบหน่วยนับเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('deleteUnit error:', error);
    res.status(500).json({ error: 'ไม่สามารถลบหน่วยนับได้' });
  }
};

module.exports = {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
};
