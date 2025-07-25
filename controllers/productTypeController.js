const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ✅ GET: โหลดประเภทสินค้าทั้งหมด
const getAllProductType = async (req, res) => {
  try {
    const productTypes = await prisma.productType.findMany({
      orderBy: { id: 'asc' },
      include: { category: true }, // ✅ รวมข้อมูลหมวดหมู่สินค้า
    });
    res.json(productTypes);
  } catch (err) {
    console.error('❌ GET ProductTypes Failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getProductTypeById = async (req, res) => {
  const { id } = req.params;
  try {
    const productType = await prisma.productType.findUnique({
      where: { id: Number(id) },
      include: { category: true }, // ✅ เผื่อใช้ในหน้าแก้ไข
    });

    if (!productType) {
      return res.status(404).json({ error: 'ไม่พบประเภทสินค้านี้' });
    }

    res.json(productType);
  } catch (err) {
    console.error('❌ getProductTypeById error:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลประเภทสินค้าได้' });
  }
};

const createProductType = async (req, res) => {
  try {
    const { name, categoryId } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'กรุณาระบุชื่อประเภทสินค้า' });
    }

    // 🔍 ตรวจสอบชื่อซ้ำ
    const existing = await prisma.productType.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return res.status(400).json({ error: 'ชื่อประเภทสินค้านี้มีอยู่ในระบบแล้ว' });
    }

    const newType = await prisma.productType.create({
      data: {
        name: name.trim(),
        categoryId: Number(categoryId),
      },
      include: { category: true }, // ✅ ส่งกลับพร้อม category ทันที
    });

    res.status(201).json(newType);
  } catch (err) {
    console.error('❌ CREATE ProductType Failed:', err);
    res.status(500).json({ error: 'ไม่สามารถเพิ่มประเภทสินค้าได้' });
  }
};

const updateProductType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, categoryId } = req.body;
    const updated = await prisma.productType.update({
      where: { id: Number(id) },
      data: {
        name,
        categoryId: Number(categoryId),
      },
      include: { category: true }, // ✅ เพื่อให้แสดงผลต่อเนื่องทันที
    });
    res.json(updated);
  } catch (err) {
    console.error('❌ UPDATE ProductType Failed:', err);
    res.status(500).json({ error: 'ไม่สามารถแก้ไขประเภทสินค้าได้' });
  }
};

const deleteProductType = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await prisma.productType.delete({
      where: { id: Number(id) },
    });
    res.json(deleted);
  } catch (err) {
    console.error('❌ DELETE ProductType Failed:', err);
    res.status(500).json({ error: 'ไม่สามารถลบประเภทสินค้าได้' });
  }
};

const getProductTypeDropdowns = async (req, res) => {
  try {
    const types = await prisma.productType.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    res.json(types);
  } catch (err) {
    console.error('❌ getProductTypeDropdowns error:', err);
    res.status(500).json({ error: 'Failed to load product types' });
  }
};

module.exports = {
  getAllProductType,
  getProductTypeById,
  createProductType,
  updateProductType,
  deleteProductType,
  getProductTypeDropdowns,
};
