const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();


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

const createBranch = async (req, res) => {
  const { name, address, phone, province, district, region, latitude, longitude, RBACEnabled } = req.body;
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

    // ✅ Clone ราคาจาก BASE_BRANCH_ID ไปยังสาขาใหม่
    try {
      const basePrices = await prisma.branchPrice.findMany({
        where: { branchId: BASE_BRANCH_ID },
      });

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
        await prisma.branchPrice.createMany({
          data: clonedPrices,
          skipDuplicates: true,
        });
      }

      res.status(201).json({
        ...created,
        clonedPrices: clonedPrices.length,
      });
    } catch (cloneErr) {
      console.warn('⚠️ Clone branchPrice error:', cloneErr);
      res.status(201).json({
        ...created,
        clonedPrices: 0,
        cloneWarning: 'Clone ราคาสำเร็จบางส่วน หรือไม่สมบูรณ์',
      });
    }
  } catch (err) {
    console.error('❌ createBranch error:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้างสาขาได้' });
  }
};

const updateBranch = async (req, res) => {
  const id = parseInt(req.params.id);
  const { name, address,phone, province, district, region, latitude, longitude, RBACEnabled } = req.body;
  try {
    const updated = await prisma.branch.update({
      where: { id },
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
    res.json(updated);
  } catch (err) {
    console.error('❌ updateBranch error:', err);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตสาขาได้' });
  }
};

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
