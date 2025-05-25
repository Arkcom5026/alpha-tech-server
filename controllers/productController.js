// ✅ server/controllers/productController.js
const { PrismaClient } = require('@prisma/client');
const { cloudinary } = require('../utils/cloudinary');
const prisma = new PrismaClient();

// POST /api/products
const createProduct = async (req, res) => {
  const data = req.body;

  if (!data.createdByBranchId) {
    return res.status(400).json({ error: 'ต้องระบุ createdByBranchId' });
  }

  try {
    console.log('📥 สร้างสินค้าใหม่:', data.title);

    const newProduct = await prisma.product.create({
      data: {
        title: data.title,
        description: data.description,
        spec: data.spec,
        cost: data.cost,
        quantity: data.quantity,
        warranty: data.warranty,
        noSN: data.noSN,
        codeType: data.codeType || 'D',
        active: data.active ?? true,
        unit: data.unit,

        template: { connect: { id: parseInt(data.templateId) } },
        branch: { connect: { id: parseInt(data.createdByBranchId) } },

        prices: {
          create: [
            { level: 1, price: data.priceLevel1 || 0 },
            { level: 2, price: data.priceLevel2 || 0 },
          ],
        },

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
        prices: true,
      },
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('❌ createProduct error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

// PUT /api/products/:id
const updateProduct = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  if (!data.updatedByBranchId) {
    return res.status(400).json({ error: 'ต้องระบุ updatedByBranchId' });
  }

  try {
    console.log('✏️ อัปเดตสินค้า:', data.title);

    // ลบภาพที่ต้องลบออกจาก Cloudinary
    if (Array.isArray(data.imagesToDelete)) {
      await Promise.all(
        data.imagesToDelete.map(img => cloudinary.uploader.destroy(img.public_id))
      );
    }

    // ลบราคาทั้งหมดก่อน แล้วสร้างใหม่
    await prisma.productPrice.deleteMany({ where: { productId: parseInt(id) } });

    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        title: data.title,
        description: data.description,
        spec: data.spec,
        cost: data.cost,
        quantity: data.quantity,
        warranty: data.warranty,
        noSN: data.noSN,
        codeType: data.codeType || 'D',
        active: data.active ?? true,
        unit: data.unit,

        template: { connect: { id: parseInt(data.templateId) } },

        prices: {
          create: [
            { level: 1, price: data.priceLevel1 || 0 },
            { level: 2, price: data.priceLevel2 || 0 },
          ],
        },

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
        prices: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('❌ updateProduct error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// ✅ ย้าย getAllProducts ออกนอก export block เพื่อแก้ 500
const getAllProducts = async (req, res) => {
  const { branchId } = req.query;
  if (!branchId) {
    return res.status(400).json({ error: 'ต้องระบุ branchId ใน query' });
  }

  try {
    console.log('📥 getAllProducts branchId:', branchId);

    const products = await prisma.product.findMany({
      where: { createdByBranchId: parseInt(branchId) },
      include: {
        images: true,
        prices: true,
        template: {
          include: {
            productProfile: true,
          },
        },
      },
      orderBy: { id: 'desc' },
    });
    res.json(products);
  } catch (error) {
    console.error('❌ getAllProducts error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  const { id } = req.params;
  const { branchId } = req.query;

  if (!branchId) {
    return res.status(400).json({ error: 'ต้องระบุ branchId ใน query' });
  }

  try {
    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(id),
        createdByBranchId: parseInt(branchId),
      },
      include: {
        images: true,
        prices: true,
        template: true,
        productProfile: true,
      },
    });
    if (!product) return res.status(404).json({ error: 'ไม่พบสินค้า' });
    res.json(product);
  } catch (error) {
    console.error('❌ getProductById error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const { branchId } = req.body;

  if (!branchId) {
    return res.status(400).json({ error: 'ต้องระบุ branchId' });
  }

  try {
    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(id),
        createdByBranchId: parseInt(branchId),
      },
      include: { images: true },
    });

    if (!product) return res.status(404).json({ error: 'ไม่พบสินค้า' });

    await Promise.all(
      product.images.map(img => cloudinary.uploader.destroy(img.public_id))
    );

    await prisma.product.delete({ where: { id: parseInt(id) } });

    res.json({ message: 'ลบสินค้าสำเร็จ' });
  } catch (error) {
    console.error('❌ deleteProduct error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

const getProductDropdowns = async (req, res) => {
  try {
    const [templates, productProfiles, categories, units] = await Promise.all([
      prisma.productTemplate.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.productProfile.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.unit.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({ templates, productProfiles, categories, units });
  } catch (error) {
    console.error('❌ getProductDropdowns error:', error);
    res.status(500).json({ error: 'Failed to load dropdowns' });
  }
};

module.exports = {
  createProduct,
  updateProduct,
  getAllProducts,
  getProductById,
  deleteProduct,
  getProductDropdowns,
};
