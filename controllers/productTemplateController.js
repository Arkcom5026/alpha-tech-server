// productTemplateController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getAllProductTemplates = async (req, res) => {
  console.log('📌 [GET] เรียกดู product templates ทั้งหมด');
  try {
    const templates = await prisma.productTemplate.findMany({
      include: {
        productProfile: {
          include: {
            productType: {
              include: {
                category: true,
              },
            },
          },
        },
        unit: true,
      },
      orderBy: { id: 'desc' },
    });

    const mapped = templates.map(t => ({
      id: t.id,
      name: t.name,
      unitId: t.unitId,
      unitName: t.unit?.name ?? '-',
      productProfileName: t.productProfile?.name ?? '-',
      productProfileId: t.productProfile?.id,
      productTypeId: t.productProfile?.productType?.id,
      categoryId: t.productProfile?.productType?.category?.id,
    }));

    res.json(mapped);
  } catch (error) {
    console.error('❌ getAllProductTemplates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createProductTemplate = async (req, res) => {
  console.log('📌 [POST] เริ่มสร้าง product template ใหม่');
  const data = req.body;

  if (!data.productProfileId || !data.unitId) {
    return res.status(400).json({ error: 'ต้องระบุ productProfileId และ unitId' });
  }

  try {
    const newTemplate = await prisma.productTemplate.create({
      data: {
        name: data.name,
        unit: { connect: { id: parseInt(data.unitId) } },
        productProfile: { connect: { id: parseInt(data.productProfileId) } },
      },
    });

    res.status(201).json(newTemplate);
  } catch (error) {
    console.error('❌ createProductTemplate error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
};

const updateProductTemplate = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;

    const updated = await prisma.productTemplate.update({
      where: { id },
      data: {
        name: data.name,
        unit: { connect: { id: parseInt(data.unitId) } },
        productProfile: {
          connect: { id: parseInt(data.productProfileId) },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('❌ updateProductTemplate error:', error);
    res.status(500).json({ error: 'Failed to update product template' });
  }
};

const deleteProductTemplate = async (req, res) => {
  console.log('📌 [DELETE] เริ่มลบ product template');
  try {
    const id = parseInt(req.params.id);
    console.log('🧩 template id:', id);

    const usedInProduct = await prisma.product.findFirst({ where: { templateId: id } });
    const usedInStock = await prisma.stockItem.findFirst({ where: { product: { templateId: id } } });
    if (usedInProduct || usedInStock) {
      return res.status(409).json({ error: 'ไม่สามารถลบได้ เพราะมีการใช้งานแล้ว' });
    }

    await prisma.productTemplate.delete({ where: { id } });

    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('❌ deleteProductTemplate error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
};

const getProductTemplateById = async (req, res) => {
  console.log('📌 [GET] โหลด product template ตาม ID');
  try {
    const id = parseInt(req.params.id);

    const template = await prisma.productTemplate.findUnique({
      where: { id },
      include: {
        unit: true,
        productProfile: {
          include: {
            productType: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    if (!template) return res.status(404).json({ error: 'ไม่พบข้อมูล' });

    res.json(template);
  } catch (error) {
    console.error('❌ getProductTemplateById error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลได้' });
  }
};




module.exports = {
  getAllProductTemplates,
  createProductTemplate,
  updateProductTemplate,
  getProductTemplateById,
  deleteProductTemplate,
};
