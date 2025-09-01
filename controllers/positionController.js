// controllers/positionController.js (no zod validation)
const { prisma, Prisma } = require('../lib/prisma');

// ===== Helpers =====
const toInt = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalize = (payload = {}) => {
  const out = { ...payload };
  if (typeof out.name === 'string') out.name = out.name.trim();
  if (typeof out.description === 'string') {
    const d = out.description.trim();
    out.description = d.length ? d : null; // เก็บเป็น null ถ้าเป็นสตริงว่าง
  }
  return out;
};

// ตรวจสอบชื่อตำแหน่งซ้ำ (case-insensitive)
const isNameTaken = async (name, excludeId = null) => {
  if (!name) return false;
  const where = excludeId
    ? { name: { equals: name, mode: 'insensitive' }, NOT: { id: excludeId } }
    : { name: { equals: name, mode: 'insensitive' } };
  const existing = await prisma.position.findFirst({ where });
  return !!existing;
};

// ===== Controllers =====
const listPositions = async (req, res) => {
  try {
    // query: search, active (true/false), page, limit
    const { search = '', active, page = '1', limit = '20' } = req.query;

    const where = {
      ...(active === 'true' ? { isActive: true } : {}),
      ...(active === 'false' ? { isActive: false } : {}),
      ...(search
        ? { name: { contains: String(search), mode: 'insensitive' } }
        : {}),
    };

    const pageNum = Math.max(toInt(page, 1), 1);
    const take = Math.min(Math.max(toInt(limit, 20), 1), 100);
    const skip = (pageNum - 1) * take;

    const [items, total] = await Promise.all([
      prisma.position.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      prisma.position.count({ where }),
    ]);

    return res.json({
      items,
      meta: {
        page: pageNum,
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    if (err instanceof Error) console.error('[listPositions] error:', err.message, err.stack);
    else console.error('[listPositions] unknown error:', err);
    return res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลตำแหน่งได้' });
  }
};

const getDropdowns = async (req, res) => {
  try {
    const { active = 'true' } = req.query;
    const where =
      active === 'true'
        ? { isActive: true }
        : active === 'false'
        ? { isActive: false }
        : {};

    const items = await prisma.position.findMany({
      select: { id: true, name: true },
      where,
      orderBy: { name: 'asc' },
    });

    return res.json(items);
  } catch (err) {
    if (err instanceof Error) console.error('[getDropdowns] error:', err.message, err.stack);
    else console.error('[getDropdowns] unknown error:', err);
    return res.status(500).json({ error: 'ไม่สามารถดึงรายการตำแหน่งได้' });
  }
};

const getById = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });

    const item = await prisma.position.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: 'ไม่พบข้อมูลตำแหน่ง' });

    return res.json(item);
  } catch (err) {
    if (err instanceof Error) console.error('[getById] error:', err.message, err.stack);
    else console.error('[getById] unknown error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
  }
};

const createPosition = async (req, res) => {
  try {
    const body = normalize(req.body || {});

    // ✅ Manual validation (no zod)
    if (typeof body.name !== 'string' || body.name.length < 2) {
      return res.status(400).json({ error: 'ชื่อตำแหน่งต้องยาวอย่างน้อย 2 ตัวอักษร' });
    }
    if (body.description != null && typeof body.description !== 'string') {
      return res.status(400).json({ error: 'รูปแบบคำอธิบายไม่ถูกต้อง' });
    }

    // ป้องกันชื่อซ้ำแบบล่วงหน้า
    if (await isNameTaken(body.name)) {
      return res.status(409).json({ error: 'ชื่อตำแหน่งนี้ถูกใช้แล้ว' });
    }

    const created = await prisma.position.create({ data: body });
    return res.status(201).json(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'ชื่อตำแหน่งนี้ถูกใช้แล้ว' });
      }
    }
    if (err instanceof Error) console.error('[createPosition] error:', err.message, err.stack);
    else console.error('[createPosition] unknown error:', err);
    return res.status(500).json({ error: 'ไม่สามารถสร้างตำแหน่งได้' });
  }
};

// รองรับ PATCH (อัปเดตบางส่วน)
const updatePosition = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });

    const body = normalize(req.body || {});

    // ✅ Manual validation เฉพาะฟิลด์ที่ส่งมา
    if (Object.prototype.hasOwnProperty.call(body, 'name')) {
      if (typeof body.name !== 'string' || body.name.length < 2) {
        return res.status(400).json({ error: 'ชื่อตำแหน่งต้องยาวอย่างน้อย 2 ตัวอักษร' });
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      if (body.description != null && typeof body.description !== 'string') {
        return res.status(400).json({ error: 'รูปแบบคำอธิบายไม่ถูกต้อง' });
      }
    }
    if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
      if (typeof body.isActive !== 'boolean') {
        return res.status(400).json({ error: 'รูปแบบ isActive ต้องเป็น boolean' });
      }
    }

    // กัน name ซ้ำก่อนอัปเดต (หากผู้ใช้ส่ง name มา)
    if (body.name && (await isNameTaken(body.name, id))) {
      return res.status(409).json({ error: 'ชื่อตำแหน่งนี้ถูกใช้แล้ว' });
    }

    const updated = await prisma.position.update({ where: { id }, data: body });
    return res.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return res.status(409).json({ error: 'ชื่อตำแหน่งนี้ถูกใช้แล้ว' });
      }
    }
    if (err instanceof Error) console.error('[updatePosition] error:', err.message, err.stack);
    else console.error('[updatePosition] unknown error:', err);
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขตำแหน่งได้' });
  }
};

// Soft delete/restore
const toggleActive = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });

    const existing = await prisma.position.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'ไม่พบข้อมูลตำแหน่ง' });

    // ถ้าจะปิดใช้งาน: ตรวจว่าไม่ได้ใช้อยู่กับ EmployeeProfile
    if (existing.isActive) {
      const inUse = await prisma.employeeProfile.count({ where: { positionId: id } });
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

    return res.json(updated);
  } catch (err) {
    if (err instanceof Error) console.error('[toggleActive] error:', err.message, err.stack);
    else console.error('[toggleActive] unknown error:', err);
    return res.status(500).json({ error: 'ไม่สามารถเปลี่ยนสถานะได้' });
  }
};

// (ออปชัน) Hard delete – แนะนำให้ปิดไว้ใน Production
const hardDelete = async (req, res) => {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });

    const inUse = await prisma.employeeProfile.count({ where: { positionId: id } });
    if (inUse > 0) {
      return res.status(409).json({ error: 'ไม่สามารถลบได้: มีพนักงานที่ยังผูกกับตำแหน่งนี้อยู่' });
    }

    await prisma.position.delete({ where: { id } });
    return res.json({ message: 'ลบข้อมูลตำแหน่งแล้ว' });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2003') {
        return res.status(409).json({ error: 'ไม่สามารถลบได้เนื่องจากมีการอ้างอิงอยู่' });
      }
    }
    if (err instanceof Error) console.error('[hardDelete] error:', err.message, err.stack);
    else console.error('[hardDelete] unknown error:', err);
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
  hardDelete, // พิจารณาปิดใช้งานในโปรดักชัน
};




