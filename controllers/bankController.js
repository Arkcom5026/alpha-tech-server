// controllers/bankController.js — Prisma singleton, validations, safer Prisma errors

const { prisma, Prisma } = require('../lib/prisma');

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const omitUndefined = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// GET /banks
const getAllBanks = async (req, res) => {
  try {
    const q = (req.query?.q || '').toString().trim();
    const includeInactive = String(req.query?.includeInactive || '0') === '1';

    const where = omitUndefined({
      ...(includeInactive ? {} : { active: true }),
      ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] } : {}),
    });

    const banks = await prisma.bank.findMany({ where, orderBy: { name: 'asc' } });
    return res.json(banks);
  } catch (err) {
    console.error('❌ [getAllBanks] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายชื่อธนาคารได้' });
  }
};

// GET /banks/:id
const getBankById = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const bank = await prisma.bank.findUnique({ where: { id } });
    if (!bank) return res.status(404).json({ message: 'ไม่พบธนาคาร' });

    return res.json(bank);
  } catch (err) {
    console.error('❌ [getBankById] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลธนาคารได้' });
  }
};

// POST /banks
const createBank = async (req, res) => {
  try {
    const name = (req.body?.name || '').toString().trim();
    const code = req.body?.code ? String(req.body.code).trim() : undefined;
    const shortName = req.body?.shortName ? String(req.body.shortName).trim() : undefined;

    if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อธนาคาร' });

    const created = await prisma.bank.create({
      data: omitUndefined({ name, code, shortName, active: true }),
    });
    return res.status(201).json(created);
  } catch (err) {
    console.error('❌ [createBank] error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ message: 'ธนาคารนี้มีอยู่แล้ว (unique constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถสร้างธนาคารได้' });
  }
};

// PATCH /banks/:id
const updateBank = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const data = omitUndefined({
      name: req.body?.name ? String(req.body.name).trim() : undefined,
      code: req.body?.code ? String(req.body.code).trim() : undefined,
      shortName: req.body?.shortName ? String(req.body.shortName).trim() : undefined,
      active: typeof req.body?.active === 'boolean' ? req.body.active : undefined,
    });

    const updated = await prisma.bank.update({ where: { id }, data });
    return res.json(updated);
  } catch (err) {
    console.error('❌ [updateBank] error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ message: 'ไม่พบธนาคารที่ต้องการแก้ไข' });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ message: 'ข้อมูลซ้ำ (unique constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขธนาคารได้' });
  }
};

// DELETE /banks/:id
const deleteBank = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    await prisma.bank.delete({ where: { id } });
    return res.json({ message: 'ลบธนาคารเรียบร้อย' });
  } catch (err) {
    console.error('❌ [deleteBank] error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ message: 'ไม่พบธนาคารที่ต้องการลบ' });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return res.status(409).json({ message: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถลบธนาคารได้' });
  }
};

module.exports = {
  getAllBanks,
  getBankById,
  createBank,
  updateBank,
  deleteBank,
};