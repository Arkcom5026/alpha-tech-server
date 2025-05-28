// ✅ server/controllers/productTemplateController.js
const { PrismaClient } = require('@prisma/client');
const { cloudinary } = require('../utils/cloudinary'); // ✅ เพิ่ม cloudinary อย่างถูกต้อง
const prisma = new PrismaClient();


// GET /api/product-templates
const getAllProductTemplates = async (req, res) => {
  console.log('📌 [GET] เรียกดู product templates ทั้งหมด');
  try {
    const templates = await prisma.productTemplate.findMany({
      include: {
        productProfile: true,
      },
      orderBy: { id: 'desc' },
    });

    const mapped = templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description, // ✅ เพิ่มตรงนี้
      productProfileName: t.productProfile?.name ?? '-',
      warranty: t.warranty,
    }));

    res.json(mapped);
  } catch (error) {
    console.error('❌ getAllProductTemplates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}


// POST /api/product-templates
const createProductTemplate = async (req, res) => {
  console.log('📌 [POST] เริ่มสร้าง product template ใหม่');
  const data = req.body;
  console.log('🧾 req.body.imagesToDelete ที่ backend รับมา:', data.imagesToDelete);

  if (!data.branchId) {
    return res.status(400).json({ error: 'ต้องระบุ branchId' });
  }

  if (!data.productProfileId) {
    return res.status(400).json({ error: 'ต้องระบุ productProfileId' });
  }

  try {
    console.log('📥 req.body.images:', data.images);

    const newTemplate = await prisma.productTemplate.create({
      data: {
        title: data.title,

        productProfile: { connect: { id: parseInt(data.productProfileId) }, },

        unit: { connect: { id: parseInt(data.unitId) } },

        warranty: data.warranty ? parseInt(data.warranty) : null,

        branch: { connect: { id: parseInt(data.branchId) }, },

        description: data.description,
        spec: data.spec,
        codeType: data.codeType || 'D',

        noSN: data.noSN || false,

        templateImages: {
          create: Array.isArray(data.images)
            ? data.images.map((img) => ({
              url: img.url,
              public_id: img.public_id,
              secure_url: img.secure_url,
            }))
            : [],
        },
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
        productProfile: {
          connect: { id: parseInt(data.productProfileId) },
        },
        unit: data.unitId
          ? { connect: { id: parseInt(data.unitId) } }
          : undefined,
        warranty: data.warranty ? parseInt(data.warranty) : null,
        branch: {
          connect: { id: parseInt(data.branchId) },
        },
        description: data.description,
        spec: data.spec,
      },
      include: {
        templateImages: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('❌ updateProductTemplate error:', error);
    res.status(500).json({ error: 'Failed to update product template' });
  }
};




// DELETE /api/product-templates/:id
const deleteProductTemplate = async (req, res) => {
  console.log('📌 [DELETE] เริ่มลบ product template');
  try {
    const id = parseInt(req.params.id);
    const branchId = parseInt(req.body.branchId);
    console.log('🧩 branchId from req.body:', branchId);

    const template = await prisma.productTemplate.findUnique({ where: { id } });
    if (template.branchId !== branchId) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบข้อมูลของสาขาอื่น' });
    }

    const usedInProduct = await prisma.product.findFirst({ where: { templateId: id } });
    const usedInStock = await prisma.stockItem.findFirst({ where: { product: { templateId: id } } });
    if (usedInProduct || usedInStock) {
      return res.status(409).json({ error: 'ไม่สามารถลบได้ เพราะมีการใช้งานแล้ว' });
    }

    const images = await prisma.productTemplateImage.findMany({
      where: { templateId: id },
    });

    for (const img of images) {
      try {
        const result = await cloudinary.uploader.destroy(img.public_id);
        console.log('🗑️ ลบจาก Cloudinary:', img.public_id, result);
      } catch (err) {
        console.error('❌ ลบภาพจาก Cloudinary ล้มเหลว:', img.public_id, err);
      }
    }

    await prisma.productTemplateImage.deleteMany({
      where: { templateId: id },
    });

    await prisma.productTemplate.delete({ where: { id } });

    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('❌ deleteProductTemplate error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
};

// GET /api/product-templates/:id
const getProductTemplateById = async (req, res) => {
  console.log('📌 [GET] โหลด product template ตาม ID');
  try {
    const id = parseInt(req.params.id);

    const template = await prisma.productTemplate.findUnique({
  where: { id },
  include: {
    templateImages: {
      select: {
        url: true,
        public_id: true,
        secure_url: true,
      },
    },
  },
});


   console.log('🎯 template.templateImages:', template.templateImages);

    if (!template) return res.status(404).json({ error: 'ไม่พบข้อมูล' });

    res.json(template);
  } catch (error) {
    console.error('❌ getProductTemplateById error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลได้' });
  }
};

// DELETE /product-templates/:id/images/delete?public_id=xxx
const deleteProductTemplateImage = async (req, res) => {
  const templateId = parseInt(req.params.id);
  const public_id = req.query.public_id;

  if (!public_id) {
    return res.status(400).json({ error: 'ต้องระบุ public_id' });
  }

  try {
    // 🔥 ลบจาก Cloudinary ก่อน
    const result = await cloudinary.uploader.destroy(public_id);
    console.log('🗑️ ลบจาก Cloudinary:', public_id, result);

    // ✅ ลบจาก Prisma DB
    await prisma.productTemplateImage.deleteMany({
      where: {
        templateId: templateId,
        public_id: public_id,
      },
    });

    res.json({ message: 'ลบภาพสำเร็จ', public_id });
  } catch (err) {
    console.error('❌ deleteProductTemplateImage error:', err);
    res.status(500).json({ error: 'Failed to delete product template image' });
  }
};

module.exports = {
  getAllProductTemplates,
  createProductTemplate,
  updateProductTemplate,
  getProductTemplateById,
  deleteProductTemplate,
  deleteProductTemplateImage,
};
