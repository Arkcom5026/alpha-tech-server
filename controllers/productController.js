// ✅ productController.js (backend)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createProduct = async (req, res) => {
  try {
    const {
      name,
      barcode,
      price,
      stock,
      unitId,
      templateId,
      profileId,
      categoryId,
      isActive,
      images = [],
      coverIndex = null
    } = req.body;

    const branchId = req.user.branchId;

    const newProduct = await prisma.product.create({
      data: {
        name,
        barcode,
        price,
        stock,
        isActive,
        unitId,
        templateId,
        profileId,
        categoryId,
        branchId,
        images: {
          create: images.map((img, index) => ({
            url: img.url,
            caption: img.caption || '',
            isCover: coverIndex === index
          }))
        }
      },
      include: {
        images: true
      }
    });

    res.status(201).json(newProduct);
  } catch (err) {
    console.error('❌ createProduct error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการเพิ่มสินค้า' });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const branchId = req.user.branchId;
    const products = await prisma.product.findMany({
      where: { branchId },
      include: { template: true, profile: true },
    });
    res.json(products);
  } catch (err) {
    console.error('❌ getAllProducts error:', err);
    res.status(500).json({ message: 'ไม่สามารถดึงข้อมูลสินค้าได้' });
  }
};

const getProductById = async (req, res) => {
  try {
    console.log('📦 ข้อมูลสินค้า ------------------------------------------------> : getProductById');
    const { id } = req.params;
    const branchId = req.user.branchId;
    const product = await prisma.product.findFirst({
      where: { id: Number(id), branchId },
      include: { template: true, profile: true },
    });
    if (!product) return res.status(404).json({ message: 'ไม่พบสินค้า' });
    res.json(product);
  } catch (err) {
    console.error('❌ getProductById error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสินค้า' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const branchId = req.user.branchId;
    const data = req.body;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'ไม่พบสินค้า' });
    if (existing.branchId !== branchId) {
      return res.status(403).json({ message: 'คุณไม่มีสิทธิ์แก้ไขสินค้าของสาขาอื่น' });
    }

    // ลบภาพเก่าทิ้งทั้งหมดก่อนสร้างใหม่
    await prisma.image.deleteMany({ where: { productId: id } });

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        barcode: data.barcode,
        price: data.price,
        stock: data.stock,
        unitId: data.unitId,
        templateId: data.templateId,
        profileId: data.profileId,
        categoryId: data.categoryId,
        isActive: data.isActive,
        images: {
          create: Array.isArray(data.images)
            ? data.images.map((img, index) => ({
                url: img.url,
                caption: img.caption || '',
                isCover: data.coverIndex === index,
              }))
            : [],
        },
      },
      include: { images: true },
    });

    res.json(updated);
  } catch (err) {
    console.error('❌ updateProduct error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการแก้ไขสินค้า' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = req.user.branchId;
    const deleted = await prisma.product.deleteMany({
      where: { id: Number(id), branchId },
    });
    if (deleted.count === 0) return res.status(404).json({ message: 'ไม่พบสินค้าหรือไม่มีสิทธิ์ลบ' });
    res.json({ message: 'ลบสินค้าสำเร็จ' });
  } catch (err) {
    console.error('❌ deleteProduct error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในการลบสินค้า' });
  }
};

// ✅ Controller: getProductDropdowns
const getProductDropdowns = async (req, res) => {
  try {
    console.log('📦 ข้อมูล dropdown ------------------------------------------------> : getProductDropdowns  units  E ');
    const [categories, productTypes, productTemplates, productProfiles] = await Promise.all([
      
      prisma.category.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.productType.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.productTemplate.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
      prisma.productProfile.findMany({ where: { active: true }, orderBy: { name: 'asc' } })
      
    ]);
    
    console.log('📦 ข้อมูล dropdown ------------------------------------------------> : getProductDropdowns  units  E ');
    const units = [
      { id: 1, name: 'เครื่อง' },
      { id: 2, name: 'ชิ้น' },
      { id: 3, name: 'ชุด' },
      { id: 4, name: 'กล่อง' }
    ];
    console.log('📦 ข้อมูล dropdown ------------------------------------------------> : getProductDropdowns  units  E ');
    return res.json({
      categories,
      productTypes,
      productTemplates,
      productProfiles,
      units
    });
  } catch (error) {
    console.error('getProductDropdowns error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูล dropdown ได้ -----------------------------' });
  }
};

module.exports = {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductDropdowns,
};
