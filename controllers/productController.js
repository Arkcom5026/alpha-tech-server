// ✅ server/controllers/productController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { cloudinary } = require('../utils/cloudinary');


// GET /api/products (Optimized)

const getAllProducts = async (req, res) => {


  const branchId = req.user?.branchId;
  const { search = '', take = 100 } = req.query;


  if (!branchId) {
    return res.status(400).json({ error: 'Missing branchId' });
  }

  try {
    const products = await prisma.product.findMany({
      where: {
        branchId: parseInt(branchId),
        active: true, // ✅ เพิ่มเงื่อนไขให้แสดงเฉพาะสินค้าที่เปิดใช้งานเท่านั้น
        title: {
          contains: search,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        warranty: true,
        branchId: true,
        template: {
          select: {
            name: true,
          },
        },
        stockItems: {
          where: { status: 'IN_STOCK' },
          select: { id: true },
        },
        prices: {
          where: { level: 1 },
          select: { price: true },
        },
      },
      take: parseInt(take),
      orderBy: { id: 'desc' },
    });

    const mapped = products.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      productTemplate: t.template?.name ?? '-',
      warranty: t.warranty,
      quantity: t.stockItems?.length ?? 0,
      price: t.prices?.[0]?.price ?? null,
      branchId: t.branchId, // ✅ เพิ่ม branchId กลับเข้า response
    }));

    res.json(mapped);
  } catch (error) {
    console.error('❌ getAllProducts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};





// POST /api/products
const createProduct = async (req, res) => {

  const data = req.body;
  const branchId = req.user?.branchId;



  if (!branchId) {
    return res.status(400).json({ error: 'Missing branchId' });
  }

  try {
    const templateId = parseInt(data.templateId);
    const unitId = parseInt(data.unitId);

    const newProduct = await prisma.product.create({
      data: {
        title: data.title,

        template: !Number.isNaN(templateId)
          ? { connect: { id: templateId } }
          : undefined,

        unit: !Number.isNaN(unitId)
          ? { connect: { id: unitId } }
          : undefined,

        branch: { connect: { id: branchId } },

        warranty: data.warranty ? parseInt(data.warranty) : null,
        description: data.description || '',
        spec: data.spec || '',
        codeType: data.codeType || 'D',
        noSN: data.noSN ?? false,
        active: data.active ?? true,
        costPrice: data.costPrice ? parseFloat(data.costPrice) : null,

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
    const branchId = req.user?.branchId;


    if (!id || !branchId) {
      return res.status(400).json({ error: 'Missing product ID or branch ID' });
    }

    const templateId = parseInt(data.templateId);
    const unitId = parseInt(data.unitId);

    const updated = await prisma.product.update({
      where: { id },
      data: {
        title: data.title,
        template: !Number.isNaN(templateId)
          ? { connect: { id: templateId } }
          : undefined,

        unit: !Number.isNaN(unitId)
          ? { connect: { id: unitId } }
          : undefined,

        warranty: data.warranty ? parseInt(data.warranty) : null,
        branch: { connect: { id: branchId } },
        description: data.description || '',
        spec: data.spec || '',
        costPrice: data.costPrice ? parseFloat(data.costPrice) : null,
        codeType: data.codeType || 'D',
        active: data.active ?? true,
        noSN: data.noSN ?? false,
      },
      include: {
        productImages: true,
        prices: true,
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

  try {
    const id = parseInt(req.params.id);
    const branchId = req.user?.branchId;



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
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid product ID' });


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
  const { public_id } = req.body;

  if (!public_id) {
    return res.status(400).json({ error: 'ต้องระบุ public_id' });
  }

  try {
    const result = await cloudinary.uploader.destroy(public_id);

    await prisma.productImage.deleteMany({
      where: {
        productId,
        public_id, // ✅ ใช้ชื่อ field ที่ถูกต้อง
      },
    });

    res.json({ message: 'ลบภาพสำเร็จ', public_id });
  } catch (err) {
    console.error('❌ deleteProductImage error:', err);
    res.status(500).json({ error: 'Failed to delete product image' });
  }
};








const getProductDropdowns = async (req, res) => {
  const branchId = req.user?.branchId;
  const productId = req.params?.id; // ✅ เปลี่ยนจาก query เป็น params


  if (!branchId) {
    return res.status(400).json({ message: 'Missing branchId from user context' });
  }

  try {
    const categories = await prisma.category.findMany();
    const productTypes = await prisma.productType.findMany();
    const productProfiles = await prisma.productProfile.findMany();
    const templates = await prisma.productTemplate.findMany({
      where: { branchId: Number(branchId) },
    });
    const units = await prisma.unit.findMany();

    let defaultValues = null;

    if (productId && !isNaN(Number(productId))) {
      const product = await prisma.product.findUnique({
        where: { id: Number(productId) },
        select: {
          id: true,
          title: true,
          description: true,
          spec: true,
          warranty: true,
          active: true,
          costPrice: true,
          codeType: true,
          noSN: true,
          unitId: true,
          template: {
            select: {
              id: true,
              productProfile: {
                select: {
                  id: true,
                  productType: {
                    select: {
                      id: true,
                      category: {
                        select: { id: true },
                      },
                    },
                  },
                },
              },
            },
          },
          productImages: true,
        },
      });

      if (product) {
        defaultValues = {
          ...product,
          templateId: product.template?.id || null,
          productProfileId: product.template?.productProfile?.id || null,
          productTypeId: product.template?.productProfile?.productType?.id || null,
          categoryId: product.template?.productProfile?.productType?.category?.id || null,
          unitId: product.unitId || null,
        };
      }
    } else {
      console.warn('⚠️ productId ไม่ถูกต้องหรือไม่ได้ส่งมา:', productId);
    }

    
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












const getProductPrices = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const branchId = req.user?.branchId;


    if (!productId || !branchId) {
      return res.status(400).json({ error: 'Missing product ID or branch ID' });
    }

    const prices = await prisma.productPrice.findMany({
      where: {
        productId,
        branchId,
      },
      orderBy: { level: 'asc' },
    });


    res.json(prices);
  } catch (error) {
    console.error('❌ getProductPrices error:', error);
    res.status(500).json({ error: 'Failed to load product prices' });
  }
};





// ✅ Controller Function: Add Product Price
async function addProductPrice(req, res) {
  try {
    const productId = parseInt(req.params.id);
    const { level, price } = req.body;
    const branchId = req.user?.branchId;

    if (!productId || !level || !price || !branchId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const created = await prisma.productPrice.create({
      data: {
        productId,
        branchId,
        level,
        price,
        active: true,
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error('❌ addProductPrice error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


// ✅ Controller Function: Update Product Price
async function updateProductPrice(req, res) {
  try {
    const productId = parseInt(req.params.productId);
    const priceId = parseInt(req.params.priceId);
    const { level, price } = req.body;
    const branchId = req.user?.branchId;

    if (!productId || !priceId || !level || !price || !branchId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ตรวจสอบว่า record นี้อยู่ภายใต้สาขานี้จริงหรือไม่
    const existing = await prisma.productPrice.findFirst({
      where: {
        id: priceId,
        productId,
        branchId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product price not found in this branch' });
    }

    const updated = await prisma.productPrice.update({
      where: { id: priceId },
      data: {
        level,
        price,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('❌ updateProductPrice error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}



// ✅ Controller Function: Delete Product Price
async function deleteProductPrice(req, res) {
  try {
    const productId = parseInt(req.params.productId);
    const priceId = parseInt(req.params.priceId);
    const branchId = req.user?.branchId;

    if (!productId || !priceId || !branchId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ตรวจสอบสิทธิ์การลบ
    const existing = await prisma.productPrice.findFirst({
      where: {
        id: priceId,
        productId,
        branchId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Product price not found in this branch' });
    }

    await prisma.productPrice.delete({
      where: { id: priceId },
    });

    return res.status(200).json({ message: 'Product price deleted successfully' });
  } catch (error) {
    console.error('❌ deleteProductPrice error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}




module.exports = {
  getAllProducts,
  createProduct,
  updateProduct,
  getProductById,
  deleteProduct,
  deleteProductImage,
  getProductDropdowns,
  getProductPrices,
  addProductPrice,
  updateProductPrice,
  deleteProductPrice,
};
