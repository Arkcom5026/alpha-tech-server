// ✅ server/controllers/productController.js
const { PrismaClient } = require('@prisma/client');
const { cloudinary } = require('../utils/cloudinary');
const prisma = new PrismaClient();

// GET /api/products
const getAllProducts = async (req, res) => {
  console.log('📌 [GET] เรียกดู products ทั้งหมด');
  const { branchId } = req.query;

  if (!branchId) {
    return res.status(400).json({ error: 'Missing branchId' });
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        branchId: parseInt(branchId),
      },
      include: {
        template: true,
      },
      orderBy: { id: 'desc' },
    });

    const mapped = products.map((t) => ({
      id: t.id,
      title: t.title,
      name: t.name,
      description: t.description,
      productTemplate: t.template?.name ?? '-',
      warranty: t.warranty,
    }));

    res.json(mapped);
  } catch (error) {
    console.error('❌ getAllProducts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/products
const createProduct = async (req, res) => {
  console.log('📌 [POST] เริ่มสร้าง product ใหม่');
  const data = req.body;

  if (!data.branchId) {
    return res.status(400).json({ error: 'ต้องระบุ branchId' });
  }

  try {
    const newProduct = await prisma.product.create({
      data: {
        name: data.name,

        unit: { connect: { id: parseInt(data.unitId) } },
        template: { connect: { id: parseInt(data.templateId) } },

        branch: { connect: { id: parseInt(data.branchId) } },

        warranty: data.warranty ? parseInt(data.warranty) : null,

        description: data.description,
        spec: data.spec,
        codeType: data.codeType || 'D',

        noSN: data.noSN || false,

        productImages: Array.isArray(data.images) && data.images.length > 0
          ? {
              create: data.images.map((img) => ({
                url: img.url,
                public_id: img.public_id,
                secure_url: img.secure_url,
                caption: img.caption || null,
                isCover: img.isCover || false,
              })),
            }
          : undefined,
      },
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('❌ createProduct error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = req.body;

    const updated = await prisma.product.update({
      where: { id },
      data: {
        title: data.title,
        template: {
          connect: { id: parseInt(data.templateId) },
        },
        unit: data.unitId
          ? { connect: { id: parseInt(data.unitId) } }
          : undefined,
        warranty: data.warranty ? parseInt(data.warranty) : null,
        updatedByBranchId: parseInt(data.branchId),
        description: data.description,
        spec: data.spec,
        cost: data.cost ? parseFloat(data.cost) : null,
        codeType: data.codeType,
        active: data.active,
        noSN: data.noSN,
      },
      include: {
        productImages: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('❌ updateProduct error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  console.log('📌 [DELETE] เริ่มลบ product');
  try {
    const id = parseInt(req.params.id);
    const branchId = parseInt(req.body.branchId);
    console.log('🧩 branchId from req.body:', branchId);

    const product = await prisma.product.findUnique({ where: { id } });
    if (product.branchId !== branchId) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบข้อมูลของสาขาอื่น' });
    }

    const usedInStock = await prisma.stockItem.findFirst({ where: { productId: id } });
    if (usedInStock) {
      return res.status(409).json({ error: 'ไม่สามารถลบได้ เพราะมีการใช้งานแล้ว' });
    }

    const images = await prisma.productImage.findMany({
      where: { productId: id },
    });

    for (const img of images) {
      try {
        const result = await cloudinary.uploader.destroy(img.public_id);
        console.log('🗑️ ลบจาก Cloudinary:', img.public_id, result);
      } catch (err) {
        console.error('❌ ลบภาพจาก Cloudinary ล้มเหลว:', img.public_id, err);
      }
    }

    await prisma.productImage.deleteMany({
      where: { productId: id },
    });

    await prisma.product.delete({ where: { id } });

    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('❌ deleteProduct error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  console.log('📌 [GET] โหลด product ตาม ID');
  try {
    const id = parseInt(req.params.id);

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        productImages: {
          select: {
            url: true,
            public_id: true,
            secure_url: true,
          },
        },
      },
    });

    console.log('🎯 product.productImages:', product.productImages);

    if (!product) return res.status(404).json({ error: 'ไม่พบข้อมูล' });

    res.json(product);
  } catch (error) {
    console.error('❌ getProductById error:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลได้' });
  }
};

// DELETE /products/:id/images/delete?public_id=xxx
const deleteProductImage = async (req, res) => {
  const productId = parseInt(req.params.id);
  const public_id = req.query.public_id;

  if (!public_id) {
    return res.status(400).json({ error: 'ต้องระบุ public_id' });
  }

  try {
    const result = await cloudinary.uploader.destroy(public_id);
    console.log('🗑️ ลบจาก Cloudinary:', public_id, result);

    await prisma.productImage.deleteMany({
      where: {
        productId: productId,
        public_id: public_id,
      },
    });

    res.json({ message: 'ลบภาพสำเร็จ', public_id });
  } catch (err) {
    console.error('❌ deleteProductImage error:', err);
    res.status(500).json({ error: 'Failed to delete product image' });
  }
};












// ✅ อัปเดตฟังก์ชัน getProductDropdowns ให้รองรับ productId และ include productImages



const getProductDropdowns = async (req, res) => {
  const { branchId, productId } = req.query;

  if (!branchId) {
    return res.status(400).json({ message: 'branchId is required' });
  }

  try {
    const categories = await prisma.category.findMany();
    const productTypes = await prisma.productType.findMany();
    const productProfiles = await prisma.productProfile.findMany();
    const templates = await prisma.productTemplate.findMany({
      where: { branchId: Number(branchId) }, // ✅ เปลี่ยนจาก createdByBranchId เป็น branchId
    });
    const units = await prisma.unit.findMany();

    let defaultValues = null;

    if (productId) {
      console.log('📌 productId:', productId);
      const product = await prisma.product.findUnique({
        where: { id: Number(productId) },
        include: {
          productImages: true,
          template: {
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
            },
          },
        },
      });

      console.log('📦 product:', product);

      if (product) {
        defaultValues = {
          ...product,
          templateId: product.template?.id || null,
          productProfileId: product.template?.productProfile?.id || null,
          productTypeId: product.template?.productProfile?.productType?.id || null,
          categoryId: product.template?.productProfile?.productType?.category?.id || null,
        };
      }
    }

    console.log('📌 ---------------- [GET] เรียกดู dropdowns สำหรับ products สำเร็จ',
      categories,
      productTypes,
      productProfiles,
      templates,
      units,
      defaultValues
    );

    return res.json({
      categories,
      productTypes,
      productProfiles,
      templates,
      units,
      defaultValues,
    });
  } catch (error) {
    console.error('❌ getProductDropdowns error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
};












module.exports = {
  getAllProducts,
  createProduct,
  updateProduct,
  getProductById,
  deleteProduct,
  deleteProductImage,
  getProductDropdowns,
};
