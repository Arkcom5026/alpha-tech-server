// productProfileController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createProductProfile = async (req, res) => {
  try {
    const { name, description, productTypeId } = req.body;
    const profile = await prisma.productProfile.create({
      data: {
        name,
        description,
        productTypeId: Number(productTypeId),
      },
    });
    res.json(profile);
  } catch (err) {
    console.error('Create Error:', err);
    res.status(500).json({ error: 'ไม่สามารถสร้างข้อมูลได้' });
  }
};

const getAllProductProfiles = async (req, res) => {
  try {
    const profiles = await prisma.productProfile.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        productType: {
          select: {
            id: true,
            name: true,
            categoryId: true,
          },
        },
      },
    });
    res.json(profiles);
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลได้' });
  }
};

const getProfilesByCategory = async (req, res) => {
  try {
    const categoryId = Number(req.params.categoryId);
    const profiles = await prisma.productProfile.findMany({
      where: {
        productType: {
          categoryId: categoryId,
        },
      },
      include: {
        productType: {
          select: { id: true, name: true, categoryId: true },
        },
      },
    });
    res.json(profiles);
  } catch (err) {
    console.error('Fetch by Category Error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลตามหมวดหมู่' });
  }
};

const getProductProfileById = async (req, res) => {
  try {
    const profile = await prisma.productProfile.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        productType: {
          select: {
            id: true,
            name: true,
            categoryId: true,
          },
        },
      },
    });
    if (!profile) return res.status(404).json({ error: 'ไม่พบข้อมูล' });
    res.json(profile);
  } catch (err) {
    console.error('Fetch by ID Error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

const updateProductProfile = async (req, res) => {
  try {
    const { name, description, productTypeId } = req.body;
    const updated = await prisma.productProfile.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        description,
        productTypeId: Number(productTypeId),
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('Update Error:', err);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตข้อมูลได้' });
  }
};

const deleteProductProfile = async (req, res) => {
  try {
    await prisma.productProfile.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ message: 'ลบข้อมูลเรียบร้อยแล้ว' });
  } catch (err) {
    console.error('Delete Error:', err);
    res.status(500).json({ error: 'ไม่สามารถลบข้อมูลได้' });
  }
};

module.exports = {
  createProductProfile,
  getAllProductProfiles,
  getProfilesByCategory,
  getProductProfileById,
  updateProductProfile,
  deleteProductProfile,
};
