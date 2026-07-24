// controllers/bankController.js — branch-owned bank runtime
const { prisma, Prisma } = require('../lib/prisma');

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const requireBranchId = (req, res) => {
  const branchId = toInt(req.user?.branchId);
  if (!branchId) {
    res.status(403).json({
      code: 'BRANCH_CONTEXT_REQUIRED',
      message: 'ไม่พบข้อมูลสาขาสำหรับบัญชีผู้ใช้นี้',
    });
    return null;
  }
  return branchId;
};

const isUniqueConstraintError = (err) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const isForeignKeyConstraintError = (err) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003';

// GET /banks
const getAllBanks = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const q = String(req.query?.q || '').trim();
    const includeInactive = String(req.query?.includeInactive || '0') === '1';

    const where = {
      branchId,
      ...(includeInactive ? {} : { active: true }),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };

    const banks = await prisma.bank.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });

    return res.json(banks);
  } catch (err) {
    console.error('[getAllBanks] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายชื่อธนาคารได้' });
  }
};

// GET /banks/:id
const getBankById = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const bank = await prisma.bank.findFirst({
      where: { id, branchId },
    });

    if (!bank) return res.status(404).json({ message: 'ไม่พบธนาคาร' });
    return res.json(bank);
  } catch (err) {
    console.error('[getBankById] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลธนาคารได้' });
  }
};

// POST /banks
const createBank = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อธนาคาร' });

    const existing = await prisma.bank.findFirst({
      where: {
        branchId,
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ message: 'ธนาคารนี้มีอยู่แล้วในสาขา' });
    }

    const created = await prisma.bank.create({
      data: {
        name,
        branchId,
        active: true,
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('[createBank] error:', err);
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ message: 'ธนาคารนี้มีอยู่แล้วในสาขา' });
    }
    return res.status(500).json({ error: 'ไม่สามารถสร้างธนาคารได้' });
  }
};

// PATCH /banks/:id
const updateBank = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const existing = await prisma.bank.findFirst({
      where: { id, branchId },
    });
    if (!existing) {
      return res.status(404).json({ message: 'ไม่พบธนาคารที่ต้องการแก้ไข' });
    }

    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
      const name = String(req.body?.name || '').trim();
      if (!name) return res.status(400).json({ message: 'กรุณาระบุชื่อธนาคาร' });

      const duplicate = await prisma.bank.findFirst({
        where: {
          branchId,
          name: { equals: name, mode: 'insensitive' },
          NOT: { id },
        },
        select: { id: true },
      });
      if (duplicate) {
        return res.status(409).json({ message: 'ธนาคารนี้มีอยู่แล้วในสาขา' });
      }

      data.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'active')) {
      if (typeof req.body.active !== 'boolean') {
        return res.status(400).json({ message: 'รูปแบบ active ต้องเป็น boolean' });
      }
      data.active = req.body.active;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'ไม่มีข้อมูลที่รองรับสำหรับการแก้ไข' });
    }

    const updated = await prisma.bank.update({
      where: { id },
      data,
    });

    return res.json(updated);
  } catch (err) {
    console.error('[updateBank] error:', err);
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ message: 'ธนาคารนี้มีอยู่แล้วในสาขา' });
    }
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขธนาคารได้' });
  }
};

// DELETE /banks/:id
const deleteBank = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ message: 'id ไม่ถูกต้อง' });

    const existing = await prisma.bank.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) {
      return res.status(404).json({ message: 'ไม่พบธนาคารที่ต้องการลบ' });
    }

    await prisma.bank.delete({ where: { id } });
    return res.json({ message: 'ลบธนาคารเรียบร้อย' });
  } catch (err) {
    console.error('[deleteBank] error:', err);
    if (isForeignKeyConstraintError(err)) {
      return res.status(409).json({ message: 'ลบไม่ได้ เนื่องจากธนาคารนี้มีการอ้างอิงอยู่' });
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
