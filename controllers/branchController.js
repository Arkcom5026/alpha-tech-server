// controllers/branchController.js — Prisma singleton, safer errors, same style across system

const { prisma, Prisma } = require('../lib/prisma');

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// GET /branches
const getAllBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
    return res.json(branches);
  } catch (err) {
    console.error('❌ [getAllBranches] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลสาขาได้' });
  }
};

// GET /branches/:id
const getBranchById = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const branch = await prisma.branch.findFirst({ where: { id } });
    if (!branch) return res.status(404).json({ error: 'ไม่พบสาขานี้' });

    return res.json(branch);
  } catch (err) {
    console.error('❌ [getBranchById] error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดขณะโหลดสาขา' });
  }
};

// POST /branches
const createBranch = async (req, res) => {
  const { name, address, phone, province, district, region, latitude, longitude, RBACEnabled } = req.body || {};
  const BASE_BRANCH_ID = 2; // ✅ สาขาหลักที่ใช้เป็นต้นแบบ

  try {
    // ✅ สร้างสาขาใหม่
    const created = await prisma.branch.create({
      data: {
        name,
        address,
        phone,
        province,
        district,
        region,
        latitude,
        longitude,
        RBACEnabled: RBACEnabled ?? true,
      },
    });

    // ✅ Clone ราคาจาก BASE_BRANCH_ID ไปยังสาขาใหม่ (best-effort)
    try {
      const basePrices = await prisma.branchPrice.findMany({ where: { branchId: BASE_BRANCH_ID } });

      const clonedPrices = basePrices.map((item) => ({
        productId: item.productId,
        branchId: created.id,
        isActive: true,
        costPrice: item.costPrice,
        priceRetail: item.priceRetail,
        priceOnline: item.priceOnline,
        priceTechnician: item.priceTechnician,
        priceWholesale: item.priceWholesale,
      }));

      if (clonedPrices.length > 0) {
        await prisma.branchPrice.createMany({ data: clonedPrices, skipDuplicates: true });
      }

      return res.status(201).json({ ...created, clonedPrices: clonedPrices.length });
    } catch (cloneErr) {
      console.warn('⚠️ [createBranch] Clone branchPrice error:', cloneErr);
      return res.status(201).json({ ...created, clonedPrices: 0, cloneWarning: 'Clone ราคาสำเร็จบางส่วน หรือไม่สมบูรณ์' });
    }
  } catch (err) {
    console.error('❌ [createBranch] error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'ชื่อสาขาซ้ำ (unique constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถสร้างสาขาได้' });
  }
};

// PATCH /branches/:id
const updateBranch = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const { name, address, phone, province, district, region, latitude, longitude, RBACEnabled } = req.body || {};

    const updated = await prisma.branch.update({
      where: { id },
      data: { name, address, phone, province, district, region, latitude, longitude, RBACEnabled: RBACEnabled ?? true },
    });

    return res.json(updated);
  } catch (err) {
    console.error('❌ [updateBranch] error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'ไม่พบสาขาที่ต้องการอัปเดต' });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'ชื่อสาขาซ้ำ (unique constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถอัปเดตสาขาได้' });
  }
};

// DELETE /branches/:id
const deleteBranch = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    await prisma.branch.delete({ where: { id } });
    return res.json({ message: 'ลบสาขาสำเร็จ' });
  } catch (err) {
    console.error('❌ [deleteBranch] error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'ไม่พบสาขาที่ต้องการลบ' });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return res.status(409).json({ error: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถลบสาขาได้' });
  }
};

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
};
