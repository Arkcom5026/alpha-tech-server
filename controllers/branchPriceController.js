// 📦 branchPriceController.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getActiveBranchPrice = async (req, res) => {
  const { productId } = req.params;
  const branchId = req.user.branchId;
  const now = new Date();



  try {
    const price = await prisma.branchPrice.findFirst({
      where: {
        branchId,
        productId: parseInt(productId),
        isActive: true,
        OR: [
          { effectiveDate: null },
          { effectiveDate: { lte: now } },
        ],
        AND: [
          { expiredDate: null },
          { expiredDate: { gte: now } },
        ],
      },
      orderBy: { effectiveDate: "desc" },
    });

    if (!price) {
      return res.status(404).json({ message: "ไม่พบราคาที่ใช้งานได้" });
    }

    res.json(price);
  } catch (err) {
    console.error("❌ getActiveBranchPrice error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const upsertBranchPrice = async (req, res) => {
  const {
    productId,
    costPrice,
    priceRetail,
    priceWholesale,
    priceTechnician,
    priceOnline,
    effectiveDate,
    expiredDate,
    note,
    isActive,
  } = req.body;

  const branchId = req.user.branchId;
  const updatedBy = req.user.id;

  try {
    const result = await prisma.branchPrice.upsert({
      where: {
        productId_branchId: {
          productId: parseInt(productId),
          branchId,
        },
      },
      update: {
        costPrice,
        priceRetail,
        priceWholesale,
        priceTechnician,
        priceOnline,
        effectiveDate,
        expiredDate,
        note,
        updatedBy,
        isActive,
      },
      create: {
        productId,
        branchId,
        costPrice,
        priceRetail,
        priceWholesale,
        priceTechnician,
        priceOnline,
        effectiveDate,
        expiredDate,
        note,
        updatedBy,
        isActive,
      },
    });

    res.json(result);
  } catch (err) {
    console.error("❌ upsertBranchPrice error:", err);
    res.status(500).json({ error: "ไม่สามารถบันทึกราคาได้" });
  }
};

const getBranchPricesByBranch = async (req, res) => {
  const branchId = req.user.branchId;

  try {
    const prices = await prisma.branchPrice.findMany({
      where: { branchId },
      include: {
        product: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json(prices);
  } catch (err) {
    console.error("❌ getBranchPricesByBranch error:", err);
    res.status(500).json({ error: "ไม่สามารถดึงรายการราคาได้" });
  }
};

const getAllProductsWithBranchPrice = async (req, res) => {
  const branchId = req.user.branchId;
  const {
    categoryId,
    productTypeId,
    productProfileId,
    templateId,
    searchText,
  } = req.query;

  if (!searchText && !categoryId && !productTypeId && !productProfileId && !templateId) {
    return res.json([]);
  }

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
          searchText && searchText.trim() !== '' && {
            OR: [
              { name: { contains: searchText, mode: 'insensitive' } },
              { description: { contains: searchText, mode: 'insensitive' } },
              { spec: { contains: searchText, mode: 'insensitive' } },
              { template: { name: { contains: searchText, mode: 'insensitive' } } },
            ],
          },
        ].filter(Boolean),
      },
      orderBy: { name: "asc" },
    });

    const prices = await prisma.branchPrice.findMany({
      where: { branchId },
    });

    const result = products.map((product) => {
      const matchedPrice = prices.find((p) => p.productId === product.id);

      return {
        product: {
          id: product.id,
          name: product.name,
          model: product.model,
          description: product.description,
          spec: product.spec,
        },
        branchPrice: matchedPrice || null,
      };
    });
   
    res.json(result);
  } catch (err) {
    console.error("❌ getAllProductsWithBranchPrice error:", err);
    res.status(500).json({ error: "ไม่สามารถโหลดรายการสินค้าได้" });
  }
};

const updateMultipleBranchPrices = async (req, res) => {
  try {
    const updates = req.body; // Array of updates

    const results = await Promise.all(
      updates.map(item =>
        prisma.branchPrice.update({
          where: {
            productId_branchId: {
              productId: item.product?.id || item.productId,
              branchId: req.user.branchId,
            }
          },
          data: {
            costPrice: item.costPrice,
            priceRetail: item.retailPrice,
            priceWholesale: item.wholesalePrice,
            priceTechnician: item.technicianPrice,
            priceOnline: item.priceOnline,
            effectiveDate: item.effectiveDate,
            expiredDate: item.expiredDate,
            note: item.note,
            isActive: item.isActive,
            updatedBy: req.user.id,
          },
        })
      )
    );

    res.json({ updated: results.length });
  } catch (err) {
    console.error("❌ updateMultipleBranchPrices error:", err);
    res.status(500).json({ error: 'อัปเดตราคาไม่สำเร็จ' });
  }
};


module.exports = {
  getActiveBranchPrice,
  upsertBranchPrice,
  getBranchPricesByBranch,
  getAllProductsWithBranchPrice,
  updateMultipleBranchPrices,
};
