// controllers/unitController.js — Prisma singleton + validations + safer errors

const { prisma, Prisma } = require('../lib/prisma');

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// GET /units
const getAllUnits = async (req, res) => {
  try {
    const units = await prisma.unit.findMany({ orderBy: { name: 'asc' } });
    return res.json(units);
  } catch (error) {
    console.error('❌ [getAllUnits] error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยนับ' });
  }
};

// GET /units/:id
const getUnitById = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const unit = await prisma.unit.findUnique({ where: { id } });
    if (!unit) return res.status(404).json({ message: 'ไม่พบหน่วยนับนี้' });

    return res.json(unit);
  } catch (error) {
    console.error('❌ [getUnitById] error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลหน่วยนับ' });
  }
};

// POST /units
const createUnit = async (req, res) => {
  try {
    const name = (req.body?.name || '').toString().trim();
    if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อหน่วยนับ' });

    const newUnit = await prisma.unit.create({ data: { name } });
    return res.status(201).json(newUnit);
  } catch (error) {
    console.error('❌ [createUnit] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'ชื่อหน่วยนับซ้ำ (unique constraint)' });
    }
    return res.status(500).json({ message: 'ไม่สามารถสร้างหน่วยนับได้' });
  }
};

// PATCH /units/:id
const updateUnit = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const name = (req.body?.name || '').toString().trim();
    if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อหน่วยนับ' });

    const updatedUnit = await prisma.unit.update({
      where: { id },
      data: { name },
    });

    return res.json(updatedUnit);
  } catch (error) {
    console.error('❌ [updateUnit] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'ไม่พบหน่วยนับที่ต้องการแก้ไข' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'ชื่อหน่วยนับซ้ำ (unique constraint)' });
    }
    return res.status(500).json({ message: 'ไม่สามารถแก้ไขหน่วยนับได้' });
  }
};

// DELETE /units/:id
const deleteUnit = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    await prisma.unit.delete({ where: { id } });
    return res.json({ message: 'ลบหน่วยนับเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('❌ [deleteUnit] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ message: 'ไม่พบหน่วยนับที่ต้องการลบ' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(409).json({ message: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' });
    }
    return res.status(500).json({ message: 'ไม่สามารถลบหน่วยนับได้' });
  }
};

module.exports = {
  getAllUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit,
};
