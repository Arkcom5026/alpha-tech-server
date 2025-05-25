// ✅ server/controllers/productTemplateController.js
const { PrismaClient } = require('@prisma/client');
const { cloudinary } = require('../utils/cloudinary'); // ✅ เพิ่ม cloudinary อย่างถูกต้อง
const prisma = new PrismaClient();


// GET /api/product-templates
const getAllProductTemplates = async (req, res) => {
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
  const data = req.body;

  if (!data.createdByBranchId) {
    return res.status(400).json({ error: 'ต้องระบุ createdByBranchId' });
  }
  try {
    console.log('📥 req.body.images:', data.images);

    const newTemplate = await prisma.productTemplate.create({
      data: {
        name: data.name,
        productProfileId: parseInt(data.productProfileId),
        unitId: parseInt(data.unitId),
        warranty: data.warranty ? parseInt(data.warranty) : null,
        createdByBranchId: parseInt(data.createdByBranchId),
        description: data.description,
        spec: data.spec,
        images: {
          create: Array.isArray(data.images)
            ? data.images
                .filter(img => img?.url && img?.public_id && img?.secure_url)
                .map(img => ({
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

// PUT /api/product-templates/:id
const updateProductTemplate = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;

    if (Array.isArray(data.imagesToDelete)) {
      for (const public_id of data.imagesToDelete) {
        try {
          const result = await cloudinary.uploader.destroy(public_id);
          console.log('🗑️ ลบภาพเฉพาะรายการจาก Cloudinary:', public_id, result);
          await prisma.templateImage.deleteMany({ where: { public_id } });
        } catch (err) {
          console.error('❌ ลบภาพเฉพาะรายการล้มเหลว:', public_id, err);
        }
      }
    }

    const updated = await prisma.productTemplate.update({
      where: { id },
      data: {
        name: data.name,
        productTypeId: data.productTypeId,
        categoryId: data.categoryId,
        unitId: parseInt(data.unitId),
        warranty: data.warranty ? parseInt(data.warranty) : null,
        createdByBranchId: data.createdByBranchId,
        description: data.description,
        spec: data.spec,
        images: {
          create: Array.isArray(data.images)
            ? data.images
                .filter(img => img?.url && img?.public_id && img?.secure_url)
                .map(img => ({
                  url: img.url,
                  public_id: img.public_id,
                  secure_url: img.secure_url,
                }))
            : [],
        },
      },
      include: {
        images: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('❌ updateProductTemplate error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
};

// DELETE /api/product-templates/:id
const deleteProductTemplate = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const branchId = parseInt(req.body.createdByBranchId);
    console.log('🧩 branchId from req.body:', branchId);

    const template = await prisma.productTemplate.findUnique({ where: { id } });
    if (template.createdByBranchId !== branchId) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบข้อมูลของสาขาอื่น' });
    }

    const usedInProduct = await prisma.product.findFirst({ where: { templateId: id } });
    const usedInStock = await prisma.stockItem.findFirst({ where: { product: { templateId: id } } });
    if (usedInProduct || usedInStock) {
      return res.status(409).json({ error: 'ไม่สามารถลบได้ เพราะมีการใช้งานแล้ว' });
    }

    const images = await prisma.templateImage.findMany({
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

    await prisma.templateImage.deleteMany({
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
  try {
    const id = parseInt(req.params.id);

    const template = await prisma.productTemplate.findUnique({
      where: { id },
      include: {
        images: {
          select: {
            url: true,
            public_id: true,
            secure_url: true,
          },
        },
      },
    });

    console.log('🎯 template.images:', template.images);

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



