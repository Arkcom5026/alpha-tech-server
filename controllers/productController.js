// ✅ server/controllers/productController.js
const { prisma, Prisma } = require('../lib/prisma');
const { v2: cloudinary } = require('cloudinary');


const getAllProducts = async (req, res) => {
  const { search = '', take = 100 } = req.query;

  try {
    const products = await prisma.product.findMany({
      where: {
        active: true,
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
        template: {
          select: {
            name: true,
          },
        },
        productImages: {
          where: { isCover: true, active: true },
          take: 1,
          select: { secure_url: true },
        },
      },
      take: parseInt(take),
      orderBy: { id: 'desc' },
    });

    const mapped = products.map((p) => ({
      id: p.id,
      name: p.name,
      model: p.model ?? null,
      description: p.description,
      productTemplate: p.template?.name ?? '-',
      imageUrl: (p.productImages && p.productImages[0] ? p.productImages[0].secure_url : null),
    }));

    res.json(mapped);
  } catch (error) {
    console.error('❌ getAllProducts error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

  const branchId = Number(req.user?.branchId);
  if (!branchId) return res.status(401).json({ error: "unauthorized" });

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
              { model: { contains: searchText, mode: "insensitive" } },
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
        branchPrice: { where: { branchId: Number(branchId), isActive: true }, select: {
            costPrice: true,
            priceRetail: true,
            priceWholesale: true,
            priceTechnician: true,
            priceOnline: true,
            isActive: true
          },
        },
        stockItems: { where: { status: 'IN_STOCK', branchId: Number(branchId) },
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

const getProductsForOnline = async (req, res) => {
  const {
    categoryId,
    productTypeId,
    productProfileId,
    templateId,
    searchText = "",
  } = req.query;

  const branchId = Number(req.user?.branchId ?? req.query.branchId);
  if (!branchId) return res.status(401).json({ error: "unauthorized" });

  try {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        branchPrice: {
          some: { isActive: true, branchId: Number(branchId),
          },
        },
        ...(searchText && {
          OR: [
            { name: { contains: searchText, mode: "insensitive" } },
            { model: { contains: searchText, mode: "insensitive" } },
            { description: { contains: searchText, mode: "insensitive" } },
            { template: { name: { contains: searchText, mode: "insensitive" } } },
          ],
        }),
        template: {
          ...(templateId && { id: Number(templateId) }),
          ...(productProfileId || productTypeId || categoryId
            ? {
                productProfile: {
                  ...(productProfileId && { id: Number(productProfileId) }),
                  ...(productTypeId || categoryId
                    ? {
                        productType: {
                          ...(productTypeId && { id: Number(productTypeId) }),
                          ...(categoryId && { categoryId: Number(categoryId) }),
                        },
                      }
                    : {}),
                },
              }
            : {}),
        },
      },
      select: {
        id: true,
        name: true,
        model: true,
        description: true,
        spec: true,
        sold: true,
        quantity: true,        
        branchPrice: {
          where: { isActive: true, branchId: Number(branchId),
          },
          select: {
            costPrice: true,
            priceOnline: true,
          },
        },
        stockItems: {
          where: {
            status: 'IN_STOCK',
            branchId,
          },
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
      model: p.model,
      description: p.description,
      spec: p.spec,
      sold: p.sold,
      quantity: p.quantity,      
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

const getProductPosById = async (req, res) => {
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

    const fullProduct = {
      ...product,
      templateId: product.template?.id ?? null,
      productProfileId: product.template?.productProfile?.id ?? null,
      productTypeId: product.template?.productProfile?.productType?.id ?? null,
      categoryId: product.template?.productProfile?.productType?.category?.id ?? null,
    };

    res.json(fullProduct);
  } catch (error) {
    console.error('getProductPosById error:', error);
    res.status(500).json({ error: 'Failed to fetch product by ID' });
  }
};

const getProductDropdowns = async (req, res) => {
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
        active: true
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

    return res.json({
      categories,
      productTypes,
      productProfiles,
      templates,
      defaultValues: null
    });
  } catch (error) {
    console.error('❌ getProductDropdowns error:', error);
    return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
};

const getProductDropdownsForOnline = async (req, res) => {
  try {
    const { categoryId, productTypeId, productProfileId } = req.query;

    // 🔢 Coerce to number when present (avoid NaN in Prisma where)
    const catId = categoryId ? Number(categoryId) : undefined;
    const typeId = productTypeId ? Number(productTypeId) : undefined;
    const profileId = productProfileId ? Number(productProfileId) : undefined;

    // 🧩 Online dropdowns should mirror POS rules: only active items + stable sorting
    const categories = await prisma.category.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const productTypes = await prisma.productType.findMany({
      where: {
        active: true,
        ...(catId ? { categoryId: catId } : {}),
      },
      select: { id: true, name: true, categoryId: true },
      orderBy: { name: 'asc' },
    });

    const productProfiles = await prisma.productProfile.findMany({
      where: {
        active: true,
        ...(typeId ? { productTypeId: typeId } : {}),
      },
      include: {
        productType: {
          select: { id: true, name: true, categoryId: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const templates = await prisma.productTemplate.findMany({
      where: {
        active: true,
        ...(profileId ? { productProfileId: profileId } : {}),
        ...(typeId
          ? { productProfile: { productTypeId: typeId } }
          : {}),
        ...(catId
          ? { productProfile: { productType: { categoryId: catId } } }
          : {}),
      },
      include: {
        productProfile: {
          include: {
            productType: { select: { id: true, name: true, categoryId: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
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
        branchPrice: {
          where: {
            isActive: true,
            branchId,
          },
          select: { costPrice: true, priceOnline: true },
        },
        stockItems: { where: { status: 'IN_STOCK', branchId },
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
      price: product.branchPrice[0]?.priceOnline ?? 0,
      isReady: product.stockItems?.length > 0,
      imageUrl: (product.productImages && product.productImages[0] ? product.productImages[0].secure_url : null),
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

const createProduct = async (req, res) => {
  const data = req.body;
  const branchId = Number(req.user?.branchId);

  if (!branchId) {
    return res.status(400).json({ error: 'Missing branchId' });
  }

  try {
    const templateId = parseInt(data.templateId);

    const newProduct = await prisma.product.create({
      data: {
        name: data.name,
        model: data.model || null,
        template: !Number.isNaN(templateId)
          ? { connect: { id: templateId } }
          : undefined,
        description: data.description || '',
        spec: data.spec || '',
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

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: data.name,
        model: data.model || null,
        template: !Number.isNaN(templateId)
          ? { connect: { id: templateId } }
          : undefined,
        description: data.description || '',
        spec: data.spec || '',
        active: data.active ?? true,
        noSN: data.noSN ?? false,
      },
      include: {
        productImages: true,
      },
    });

    if (data.branchPrice) {
      await prisma.branchPrice.upsert({
        where: {
          productId_branchId: {
            productId: id,
            branchId: Number(branchId),
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

const deleteProduct = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const branchId = req.user?.branchId;

    const price = await prisma.branchPrice.findFirst({
      where: {
        productId: id,
        branchId,
      },
    });
    if (!price) {
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

    await prisma.branchPrice.deleteMany({ where: { productId: id } });
    await prisma.productImage.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });

    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    console.error('❌ deleteProduct error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

const deleteProductImage = async (req, res) => {
  const productId = parseInt(req.params.id);
  const { public_id } = req.body;
  const branchId = req.user.branchId;

  if (!public_id) {
    return res.status(400).json({ error: 'ต้องระบุ public_id' });
  }

  try {
    const price = await prisma.branchPrice.findFirst({
      where: {
        productId,
        branchId,
      },
    });
    if (!price) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลบภาพสินค้านี้' });
    }

    await cloudinary.uploader.destroy(public_id);

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


module.exports = {
  getAllProducts,
  createProduct,
  updateProduct,
  getProductPosById,
  deleteProduct,
  deleteProductImage,
  getProductDropdowns,  
  getProductsForOnline,
  getProductOnlineById,
  getProductDropdownsForOnline,
  getProductsForPos,
  
};




