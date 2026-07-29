/* eslint-env node */

// src/modules/position/controllers/positionController.js — branch-owned position runtime
const { prisma, Prisma } = require('../../../../lib/prisma');

const toInt = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : value);

const normalizeDescription = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizeRoleField = (row = {}) => ({
  ...row,
  role: row.role ?? row.defaultRole ?? row.systemRole ?? null,
});

const isNameTaken = async ({ branchId, name, excludeId = null }) => {
  if (!branchId || !name) return false;

  const existing = await prisma.position.findFirst({
    where: {
      branchId,
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });

  return Boolean(existing);
};

const isUniqueConstraintError = (err) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const listPositions = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const q = String(req.query.q ?? req.query.search ?? '').trim();
    const { active, page = '1', limit = '20' } = req.query;

    const where = {
      branchId,
      ...(active === 'true' ? { isActive: true } : {}),
      ...(active === 'false' ? { isActive: false } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };

    const pageNum = Math.max(toInt(page, 1), 1);
    const take = Math.min(Math.max(toInt(limit, 20), 1), 100);
    const skip = (pageNum - 1) * take;

    const [itemsRaw, total] = await Promise.all([
      prisma.position.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.position.count({ where }),
    ]);

    return res.json({
      items: itemsRaw.map(normalizeRoleField),
      meta: {
        page: pageNum,
        limit: take,
        total,
        pages: Math.max(1, Math.ceil(total / take)),
      },
    });
  } catch (err) {
    console.error('[listPositions] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลตำแหน่งได้' });
  }
};

const getDropdowns = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const { active = 'true' } = req.query;
    const where = {
      branchId,
      ...(active === 'true' ? { isActive: true } : {}),
      ...(active === 'false' ? { isActive: false } : {}),
    };

    const items = await prisma.position.findMany({
      select: { id: true, name: true },
      where,
      orderBy: { name: 'asc' },
    });

    return res.json(items);
  } catch (err) {
    console.error('[getDropdowns] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถดึงรายการตำแหน่งได้' });
  }
};

const getById = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });

    const item = await prisma.position.findFirst({
      where: { id, branchId },
    });

    if (!item) return res.status(404).json({ error: 'ไม่พบข้อมูลตำแหน่ง' });
    return res.json(normalizeRoleField(item));
  } catch (err) {
    console.error('[getById] error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

const createPosition = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const name = normalizeText(req.body?.name);
    const description = normalizeDescription(req.body?.description);

    if (typeof name !== 'string' || name.length < 2) {
      return res.status(400).json({ error: 'ชื่อตำแหน่งต้องยาวอย่างน้อย 2 ตัวอักษร' });
    }
    if (description != null && typeof description !== 'string') {
      return res.status(400).json({ error: 'รูปแบบคำอธิบายไม่ถูกต้อง' });
    }

    if (await isNameTaken({ branchId, name })) {
      return res.status(409).json({ error: 'ชื่อตำแหน่งนี้ถูกใช้แล้วในสาขา' });
    }

    const created = await prisma.position.create({
      data: {
        name,
        description,
        branchId,
        isActive: true,
      },
    });

    return res.status(201).json(normalizeRoleField(created));
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: 'ชื่อตำแหน่งนี้ถูกใช้แล้วในสาขา' });
    }
    console.error('[createPosition] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถสร้างตำแหน่งได้' });
  }
};

const updatePosition = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });

    const existing = await prisma.position.findFirst({
      where: { id, branchId },
    });
    if (!existing) return res.status(404).json({ error: 'ไม่พบข้อมูลตำแหน่ง' });

    const data = {};

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name')) {
      const name = normalizeText(req.body.name);
      if (typeof name !== 'string' || name.length < 2) {
        return res.status(400).json({ error: 'ชื่อตำแหน่งต้องยาวอย่างน้อย 2 ตัวอักษร' });
      }
      if (await isNameTaken({ branchId, name, excludeId: id })) {
        return res.status(409).json({ error: 'ชื่อตำแหน่งนี้ถูกใช้แล้วในสาขา' });
      }
      data.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
      const description = normalizeDescription(req.body.description);
      if (description != null && typeof description !== 'string') {
        return res.status(400).json({ error: 'รูปแบบคำอธิบายไม่ถูกต้อง' });
      }
      data.description = description;
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'isActive')) {
      if (typeof req.body.isActive !== 'boolean') {
        return res.status(400).json({ error: 'รูปแบบ isActive ต้องเป็น boolean' });
      }
      data.isActive = req.body.isActive;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'ไม่มีข้อมูลที่รองรับสำหรับการแก้ไข' });
    }

    const updated = await prisma.position.update({
      where: { id },
      data,
    });

    return res.json(normalizeRoleField(updated));
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return res.status(409).json({ error: 'ชื่อตำแหน่งนี้ถูกใช้แล้วในสาขา' });
    }
    console.error('[updatePosition] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขตำแหน่งได้' });
  }
};

const toggleActive = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });

    const existing = await prisma.position.findFirst({
      where: { id, branchId },
    });
    if (!existing) return res.status(404).json({ error: 'ไม่พบข้อมูลตำแหน่ง' });

    if (existing.isActive) {
      const inUse = await prisma.employeeProfile.count({
        where: {
          branchId,
          positionId: id,
        },
      });

      if (inUse > 0) {
        return res.status(409).json({
          error: 'ไม่สามารถปิดใช้งานได้: มีพนักงานที่ยังผูกกับตำแหน่งนี้อยู่',
        });
      }
    }

    const updated = await prisma.position.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    return res.json(normalizeRoleField(updated));
  } catch (err) {
    console.error('[toggleActive] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถเปลี่ยนสถานะได้' });
  }
};

const hardDelete = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });

    const existing = await prisma.position.findFirst({
      where: { id, branchId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'ไม่พบข้อมูลตำแหน่ง' });

    const inUse = await prisma.employeeProfile.count({
      where: {
        branchId,
        positionId: id,
      },
    });

    if (inUse > 0) {
      return res.status(409).json({
        error: 'ไม่สามารถลบได้: มีพนักงานที่ยังผูกกับตำแหน่งนี้อยู่',
      });
    }

    await prisma.position.delete({ where: { id } });
    return res.json({ message: 'ลบข้อมูลตำแหน่งแล้ว' });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return res.status(409).json({ error: 'ไม่สามารถลบได้เนื่องจากมีการอ้างอิงอยู่' });
    }
    console.error('[hardDelete] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถลบตำแหน่งได้' });
  }
};

module.exports = {
  listPositions,
  getDropdowns,
  getById,
  createPosition,
  updatePosition,
  toggleActive,
  hardDelete,
};
