// controllers/branchController.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ✅ GET: /api/branches
const getAllBranches = async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(branches);
  } catch (err) {
    console.error('❌ getAllBranches error:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลสาขาได้' });
  }
};

// ✅ GET: /api/branches/:id
const getBranchById = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const branch = await prisma.branch.findUnique({
      where: { id },
    });
    if (!branch) return res.status(404).json({ error: 'ไม่พบสาขานี้' });
    res.json(branch);
  } catch (err) {
    console.error('❌ getBranchById error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดขณะโหลดสาขา' });
  }
};

// ✅ POST: /api/branches
const createBranch = async (req, res) => {
  const { name, province, district, latitude, longitude } = req.body;
  try {
    const created = await prisma.branch.create({
      data: { name, province, district, latitude, longitude },
    });
    res.status(201).json(created);
  } catch (err) {
    console.error('❌ createBranch error:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้างสาขาได้' });
  }
};

// ✅ PUT: /api/branches/:id
const updateBranch = async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, province, district, latitude, longitude } = req.body;
  try {
    const updated = await prisma.branch.update({
      where: { id },
      data: { name, province, district, latitude, longitude },
    });
    res.json(updated);
  } catch (err) {
    console.error('❌ updateBranch error:', err);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตสาขาได้' });
  }
};

// ✅ DELETE: /api/branches/:id
const deleteBranch = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.branch.delete({ where: { id } });
    res.json({ message: 'ลบสาขาสำเร็จ' });
  } catch (err) {
    console.error('❌ deleteBranch error:', err);
    res.status(500).json({ error: 'ไม่สามารถลบสาขาได้' });
  }
};

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
};
