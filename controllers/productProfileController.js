// productProfileController.js
const prisma = require('../prisma/client');

exports.createProductProfile = async (req, res) => {
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

exports.getAllProductProfiles = async (req, res) => {
  try {
    const profiles = await prisma.productProfile.findMany({
      include: {
        productType: {
          select: { id: true, name: true },
        },
      },
    });
    res.json(profiles);
  } catch (err) {
    console.error('Fetch Error:', err);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลได้' });
  }
};

exports.getProductProfileById = async (req, res) => {
  try {
    const profile = await prisma.productProfile.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        productType: {
          select: { id: true, name: true },
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

exports.updateProductProfile = async (req, res) => {
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

exports.deleteProductProfile = async (req, res) => {
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
