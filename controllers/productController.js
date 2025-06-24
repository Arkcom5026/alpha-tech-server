// ✅ server/controllers/productController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { cloudinary } = require('../utils/cloudinary');



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
        name: {
          contains: search,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        model: true,
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
      name: t.name,
      description: t.description,
      productTemplate: t.template?.name ?? '-',
      warranty: t.warranty,
      quantity: t.stockItems?.length ?? 0,
      branchId: t.branchId, // ✅ เพิ่ม branchId กลับเข้า response
    }));

    res.json(mapped);
  } catch (error) {
    console.error('❌ getAllProducts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getProductsByBranch = async (req, res) => {
  try {
    const branchId = req.user.branchId;

    const products = await prisma.product.findMany({
      where: {
        branchPrices: {
          some: {
            branchId: branchId,
          },
        },
      },
      include: {
        branchPrices: {
          where: { branchId: branchId },
          select: {
            costPrice: true,
            priceRetail: true,
            priceWholesale: true,
            priceTechnician: true,
            priceOnline: true,
            productId: true,
            branchId: true,
          },
        },
        
        category: true,
        productType: true,
        productProfile: true,
        productTemplate: true,
        productImages: true,
      },
    });

    res.json(products);
  } catch (error) {
    console.error('getProductsByBranch error:', error);
    res.status(500).json({ error: 'Failed to fetch products for this branch' });
  }
};

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
        name: data.name,
        model: data.model || null,

        template: !Number.isNaN(templateId)
          ? { connect: { id: templateId } }
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


    const bp = data.branchPrice || {};
    await prisma.branchPrice.create({
      data: {
        product: { connect: { id: newProduct.id } },
        branch: { connect: { id: branchId } },
        costPrice: bp.costPrice ?? 0,
        priceWholesale: bp.priceWholesale ?? 0,
        priceTechnician: bp.priceTechnician ?? 0,
        priceRetail: bp.priceRetail ?? 0,
        priceOnline: bp.priceOnline ?? 0,
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
        name: data.name,
        model: data.model || null,
        template: !Number.isNaN(templateId)
          ? { connect: { id: templateId } }
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

    // ✅ Upsert BranchPrice
    if (data.branchPrice) {
      await prisma.branchPrice.upsert({
        where: {
          productId_branchId: {
            productId: id,
            branchId: branchId,
          },
        },
        update: {
          costPrice: data.branchPrice.costPrice,
          priceWholesale: data.branchPrice.priceWholesale,
          priceTechnician: data.branchPrice.priceTechnician,
          priceRetail: data.branchPrice.priceRetail,
          priceOnline: data.branchPrice.priceOnline,
        },
        create: {
          productId: id,
          branchId: branchId,
          costPrice: data.branchPrice.costPrice,
          priceWholesale: data.branchPrice.priceWholesale,
          priceTechnician: data.branchPrice.priceTechnician,
          priceRetail: data.branchPrice.priceRetail,
          priceOnline: data.branchPrice.priceOnline,
        },
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('❌ updateProduct error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};


const searchProducts = async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Missing search query' });

  try {
    const results = await prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        template: true,
      },
      take: 20,
      orderBy: { name: 'asc' },
    });

    res.json(results);
  } catch (error) {
    console.error('❌ [searchProducts]', error);
    res.status(500).json({ error: 'Search failed' });
  }
};
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

    // 🔥 ลบราคาสินค้าที่สาขาทั้งหมดก่อนลบ product
    await prisma.branchPrice.deleteMany({
      where: { productId: id },
    });

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

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = req.user.branchId;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        branchPrice: {
          where: { branchId: branchId },
          select: {
            id: true,
            costPrice: true,
            priceRetail: true,
            priceWholesale: true,
            priceTechnician: true,
            priceOnline: true,
            productId: true,
            branchId: true,
            effectiveDate: true,
            expiredDate: true,
            note: true,
            updatedBy: true,
            isActive: true,
          },
        },
        
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

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    console.log('getProductById product:', product);

    res.json(product);
  } catch (error) {
    console.error('getProductById error:', error);
    res.status(500).json({ error: 'Failed to fetch product by ID' });
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
  const productId = req.params?.id;

  if (!branchId) {
    return res.status(400).json({ message: 'Missing branchId from user context' });
  }

  try {
    const categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    const productTypes = await prisma.productType.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });

    const productProfiles = await prisma.productProfile.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: {
        productType: {
          include: {
            category: true,
          },
        },
      },
    });

    const templates = await prisma.productTemplate.findMany({
      where: {
        active: true,
        branchId,
      },
      orderBy: { name: 'asc' },
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
    });

    let defaultValues = null;

    if (productId && !isNaN(Number(productId))) {
      const product = await prisma.product.findUnique({
        where: { id: Number(productId) },
        select: {
          id: true,
          name: true,
          description: true,
          spec: true,
          warranty: true,
          active: true,
          codeType: true,
          noSN: true,
          
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
          
        };
      }
    }


    return res.json({
      categories,
      productTypes,
      productProfiles,
      templates,
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


const getProductsForOnline = async (req, res) => {
  const {
    categoryId,
    productTypeId,
    productProfileId,
    templateId,
    searchText = "",
  } = req.query;

  const branchId = req.user?.branchId ?? (req.query.branchId ? Number(req.query.branchId) : null);
  if (!branchId) return res.status(400).json({ error: "branchId is required" });

  try {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        branchPrice: {
          some: {
            isActive: true,
            branchId,
          },
        },
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
        ...(searchText && {
          OR: [
            { name: { contains: searchText, mode: "insensitive" } },
            { description: { contains: searchText, mode: "insensitive" } },
            { template: { name: { contains: searchText, mode: "insensitive" } } },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        spec: true,
        sold: true,
        quantity: true,
        warranty: true,
        branchPrice: {
          where: {
            isActive: true,
            branchId,
          },
          select: {
            costPrice: true,
            priceOnline: true,
          },
        },
        stockItems: {
          where: { status: 'IN_STOCK' },
          select: { id: true },
        },
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
      name: p.name,
      description: p.description,
      spec: p.spec,
      sold: p.sold,
      quantity: p.quantity,
      warranty: p.warranty,
      priceOnline: p.branchPrice[0]?.priceOnline ?? null,
      isReady: p.stockItems?.length > 0,
      imageUrl: p.productImages[0]?.secure_url || null,
      category: p.template?.productProfile?.productType?.category?.name || null,
      productType: p.template?.productProfile?.productType?.name || null,
      productProfile: p.template?.productProfile?.name || null,
      productTemplate: p.template?.name || null,
    }));

    res.json(result);
  } catch (error) {
    console.error("\u274C getProductsForOnline error:", error);
    res.status(500).json({ error: "Failed to fetch online products" });
  }
};


const getProductsForPos = async (req, res) => {
  const {
    categoryId,
    productTypeId,
    productProfileId,
    templateId,
    searchText = "",
  } = req.query;

  const branchId = req.user?.branchId;
  if (!branchId) return res.status(400).json({ error: "branchId is required" });

  try {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        AND: [
          templateId && { templateId: Number(templateId) },
          productProfileId && {
            template: {
              productProfileId: Number(productProfileId),
            },
          },
          productTypeId && {
            template: {
              productProfile: {
                productTypeId: Number(productTypeId),
              },
            },
          },
          categoryId && {
            template: {
              productProfile: {
                productType: {
                  categoryId: Number(categoryId),
                },
              },
            },
          },
          searchText && {
            OR: [
              { name: { contains: searchText, mode: "insensitive" } },
              { description: { contains: searchText, mode: "insensitive" } },
              { template: { name: { contains: searchText, mode: "insensitive" } } },
            ],
          },
        ].filter(Boolean),
      },
      select: {
        id: true,
        name: true,
        model: true, // ✅ เพิ่ม model ที่นี่
        description: true,
        spec: true,
        sold: true,
        quantity: true,
        warranty: true,
        branchPrice: {
          where: {
            branchId,
          },
          select: {
            costPrice: true,
            priceRetail: true,
            priceWholesale: true,
            priceTechnician: true,
            priceOnline: true,
            isActive: true
          },
        },
        stockItems: {
          where: { status: 'IN_STOCK' },
          select: { id: true },
        },
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
      name: p.name,
      model: p.model || null, // ✅ เพิ่มส่ง model ออกมาด้วย
      description: p.description,
      spec: p.spec,
      sold: p.sold,
      quantity: p.quantity,
      warranty: p.warranty,

      costPrice: p.branchPrice[0]?.costPrice ?? null,
      priceRetail: p.branchPrice[0]?.priceRetail ?? null,
      priceWholesale: p.branchPrice[0]?.priceWholesale ?? null,
      priceTechnician: p.branchPrice[0]?.priceTechnician ?? null,
      priceOnline: p.branchPrice[0]?.priceOnline ?? null,
      isActive: p.branchPrice[0]?.isActive ?? false,
      isReady: p.stockItems?.length > 0,
      imageUrl: p.productImages[0]?.secure_url || null,
      category: p.template?.productProfile?.productType?.category?.name || null,
      productType: p.template?.productProfile?.productType?.name || null,
      productProfile: p.template?.productProfile?.name || null,
      productTemplate: p.template?.name || null,
    }));    
    res.json(result);
  } catch (error) {
    console.error("\u274C getProductsForPos error:", error);
    res.status(500).json({ error: "Failed to fetch POS products" });
  }
};




const getProductOnlineById = async (req, res) => {
  try {
    const { id } = req.params;
    const branchId = req.query.branchId ? Number(req.query.branchId) : null;
    if (!branchId) return res.status(400).json({ error: "branchId is required" });

    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
      select: {
        id: true,
        name: true,
        description: true,
        spec: true,
        sold: true,
        quantity: true,
        warranty: true,
        branchPrice: {
          where: {
            isActive: true,
            branchId,
          },
          select: { costPrice: true },
        },
        stockItems: {
          where: { status: 'IN_STOCK' },
          select: { id: true },
        },
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
      name: product.name,
      description: product.description,
      spec: product.spec,
      sold: product.sold,
      quantity: product.quantity,
      warranty: product.warranty,
      price: product.branchPrice[0]?.price ?? 0,
      isReady: product.stockItems?.length > 0,
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
  getProductsForPos,
  getProductsByBranch,
};
