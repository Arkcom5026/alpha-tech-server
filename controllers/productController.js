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
      // price: t.prices?.[0]?.price ?? null,
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
        codeType: data.codeType || 'D',
        active: data.active ?? true,
        noSN: data.noSN ?? false,
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





const deleteProductImage = async (req, res) => {
  const productId = parseInt(req.params.id);
  const { public_id } = req.body;
  const branchId = req.user.branchId; // ✅ ต้องใช้จาก token เท่านั้น

  if (!public_id) {
    return res.status(400).json({ error: 'ต้องระบุ public_id' });
  }

  try {
    // ตรวจสอบว่า productId นี้เป็นของ branch นั้นก่อน
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        branchId,
      },
    });

    if (!product) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบภาพสินค้านี้' });
    }

    // ลบภาพจาก Cloudinary
    const result = await cloudinary.uploader.destroy(public_id);

    // ลบจากฐานข้อมูลเฉพาะภาพที่ผูกกับสินค้านั้น ๆ
    await prisma.productImage.deleteMany({
      where: {
        productId,
        public_id,
      },
    });

    res.json({ message: 'ลบภาพสำเร็จ', public_id });
  } catch (err) {
    console.error('❌ deleteProductImage error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดขณะลบภาพสินค้า' });
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


const getProductDropdownsForOnline = async (req, res) => {
  try {
    const categories = await prisma.category.findMany();

    const productTypes = await prisma.productType.findMany({
      select: {
        id: true,
        name: true,
        categoryId: true,
      },
    });

    const productProfiles = await prisma.productProfile.findMany({
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

    const templates = await prisma.productTemplate.findMany({
      include: {
        productProfile: {
          include: {
            productType: {
              select: {
                id: true,
                name: true,
                categoryId: true,
              },
            },
          },
        },
      },
    });

    return res.json({
      categories,
      productTypes,
      productProfiles,
      templates,
    });
  } catch (error) {
    console.error('❌ getProductDropdownsForOnline error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
};




const searchProducts = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Missing search query' });

  try {
    const results = await prisma.product.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        template: true,
      },
      take: 20,
      orderBy: { title: 'asc' },
    });

    res.json(results);
  } catch (error) {
    console.error('❌ [searchProducts]', error);
    res.status(500).json({ error: 'Search failed' });
  }
};



const getProductsForOnline = async (req, res) => {
  const {
    categoryId,
    productTypeId,
    productProfileId,
    templateId,
    searchText = "", // ✅ เพิ่มตรงนี้
  } = req.query;

  try {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        ...(templateId && { templateId: Number(templateId) }),
        ...(productProfileId && {
          template: {
            productProfileId: Number(productProfileId),
          },
        }),
        ...(productTypeId && {
          template: {
            productProfile: {
              productTypeId: Number(productTypeId),
            },
          },
        }),
        ...(categoryId && {
          template: {
            productProfile: {
              productType: {
                categoryId: Number(categoryId),
              },
            },
          },
        }),

        // ✅ เพิ่มส่วนนี้เพื่อให้ค้นหาด้วย title หรือ description ได้
        ...(searchText && {
          OR: [
            { title: { contains: searchText, mode: "insensitive" } },
            { description: { contains: searchText, mode: "insensitive" } },
            { template: { name: { contains: searchText, mode: "insensitive" } } },
          ],
        }),
      },

      select: {
        id: true,
        title: true,
        description: true,
        spec: true,
        sold: true,
        quantity: true,
        warranty: true,        
        productImages: {
          where: { isCover: true, active: true },
          take: 1,
          select: {
            secure_url: true,
          },
        },
        template: {
          select: {
            name: true,
            productProfile: {
              select: {
                name: true,
                productType: {
                  select: {
                    name: true,
                    category: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = products.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      spec: p.spec,
      sold: p.sold,
      quantity: p.quantity,
      warranty: p.warranty,
      price: p.price,
      imageUrl: p.productImages[0]?.secure_url || null,
      category: p.template?.productProfile?.productType?.category?.name || null,
      productType: p.template?.productProfile?.productType?.name || null,
      productProfile: p.template?.productProfile?.name || null,
      productTemplate: p.template?.name || null,
    }));

    res.json(result);
  } catch (error) {
    console.error("❌ getProductsForOnline error:", error);
    res.status(500).json({ error: "Failed to fetch online products" });
  }
};



const getProductOnlineById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        title: true,
        description: true,
        spec: true,
        sold: true,
        quantity: true,
        warranty: true,
        productImages: {
          where: { active: true },
          select: {
            secure_url: true,
          },
        },
        template: {
          select: {
            name: true,
            productProfile: {
              select: {
                name: true,
                productType: {
                  select: {
                    name: true,
                    category: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: "ไม่พบสินค้า" });
    }

    const result = {
      id: product.id,
      title: product.title,
      description: product.description,
      spec: product.spec,
      sold: product.sold,
      quantity: product.quantity,
      warranty: product.warranty,
      price: 0, // ใช้ 0 ตามที่คุณระบุไว้ก่อน
      imageUrl: product.productImages?.[0]?.secure_url || null,
      productImages: product.productImages || [],
      category: product.template?.productProfile?.productType?.category?.name || null,
      productType: product.template?.productProfile?.productType?.name || null,
      productProfile: product.template?.productProfile?.name || null,
      productTemplate: product.template?.name || null,
    };

    res.json(result);
  } catch (error) {
    console.error("❌ getProductOnlineById error:", error);
    res.status(500).json({ error: "Failed to fetch product details" });
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
  searchProducts,
  getProductsForOnline,
  getProductOnlineById,
  getProductDropdownsForOnline,
};
