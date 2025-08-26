// 📦 controllers/branchPriceController.js — Prisma singleton, Decimal-safe, branch scope, robust date logic

const { prisma, Prisma } = require('../lib/prisma');

// Helpers
const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// GET /branch-prices/active/:productId
const getActiveBranchPrice = async (req, res) => {
  try {
    const productId = toInt(req.params?.productId);
    const branchId = toInt(req.user?.branchId);
    const now = new Date();

    if (!productId || !branchId) {
      return res.status(400).json({ message: 'productId หรือ branchId ไม่ถูกต้อง' });
    }

    // ✅ effectiveDate <= now (หรือเป็น null) และ (expiredDate >= now หรือเป็น null)
    const price = await prisma.branchPrice.findFirst({
      where: {
        branchId,
        productId,
        isActive: true,
        AND: [
          { OR: [{ effectiveDate: null }, { effectiveDate: { lte: now } }] },
          { OR: [{ expiredDate: null }, { expiredDate: { gte: now } }] },
        ],
      },
      orderBy: [{ effectiveDate: 'desc' }, { updatedAt: 'desc' }],
    });

    if (!price) return res.status(404).json({ message: 'ไม่พบราคาที่ใช้งานได้' });
    return res.json(price);
  } catch (err) {
    console.error('❌ getActiveBranchPrice error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /branch-prices/upsert
const upsertBranchPrice = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const updatedBy = toInt(req.user?.id) || toInt(req.user?.employeeId);

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
    } = req.body || {};

    if (!branchId || !productId) {
      return res.status(400).json({ error: 'branchId หรือ productId ไม่ถูกต้อง' });
    }

    const pid = toInt(productId);
    const eff = effectiveDate ? new Date(effectiveDate) : null;
    const exp = expiredDate ? new Date(expiredDate) : null;

    const result = await prisma.branchPrice.upsert({
      where: {
        productId_branchId: { productId: pid, branchId },
      },
      update: {
        costPrice: D(costPrice),
        priceRetail: D(priceRetail),
        priceWholesale: D(priceWholesale),
        priceTechnician: D(priceTechnician),
        priceOnline: D(priceOnline),
        effectiveDate: eff,
        expiredDate: exp,
        note: note || null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        updatedBy,
      },
      create: {
        productId: pid,
        branchId,
        costPrice: D(costPrice),
        priceRetail: D(priceRetail),
        priceWholesale: D(priceWholesale),
        priceTechnician: D(priceTechnician),
        priceOnline: D(priceOnline),
        effectiveDate: eff,
        expiredDate: exp,
        note: note || null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        updatedBy,
      },
    });

    return res.json(result);
  } catch (err) {
    console.error('❌ upsertBranchPrice error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return res.status(400).json({ error: 'อ้างอิง product/branch ไม่ถูกต้อง' });
    }
    return res.status(500).json({ error: 'ไม่สามารถบันทึกราคาได้' });
  }
};

// GET /branch-prices
const getBranchPricesByBranch = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const prices = await prisma.branchPrice.findMany({
      where: { branchId },
      include: { product: { select: { id: true, name: true, model: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json(prices);
  } catch (err) {
    console.error('❌ getBranchPricesByBranch error:', err);
    return res.status(500).json({ error: 'ไม่สามารถดึงรายการราคาได้' });
  }
};

// GET /branch-prices/products — ใช้กรองสินค้าและแนบราคาสาขา
const getAllProductsWithBranchPrice = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const { categoryId, productTypeId, productProfileId, templateId, searchText } = req.query || {};

    if (!branchId) return res.status(401).json({ error: 'unauthorized' });
    if (!searchText && !categoryId && !productTypeId && !productProfileId && !templateId) {
      return res.json([]);
    }

    const whereAND = [];
    if (templateId) whereAND.push({ templateId: toInt(templateId) });
    if (productProfileId) whereAND.push({ template: { productProfileId: toInt(productProfileId) } });
    if (productTypeId) whereAND.push({ template: { productProfile: { productTypeId: toInt(productTypeId) } } });
    if (categoryId) whereAND.push({ template: { productProfile: { productType: { categoryId: toInt(categoryId) } } } });
    if (searchText && String(searchText).trim() !== '') {
      const q = String(searchText).trim();
      whereAND.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { spec: { contains: q, mode: 'insensitive' } },
          { template: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const products = await prisma.product.findMany({
      where: { active: true, AND: whereAND },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        model: true,
        description: true,
        spec: true,
      },
    });

    // ดึงราคาของสาขารวดเดียวแล้วแมป (ประสิทธิภาพดีกว่า)
    const productIds = products.map((p) => p.id);
    const prices = await prisma.branchPrice.findMany({ where: { branchId, productId: { in: productIds } } });
    const priceMap = new Map(prices.map((p) => [p.productId, p]));

    const result = products.map((product) => ({
      product,
      branchPrice: priceMap.get(product.id) || null,
    }));

    return res.json(result);
  } catch (err) {
    console.error('❌ getAllProductsWithBranchPrice error:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายการสินค้าได้' });
  }
};

// PATCH /branch-prices/bulk
const updateMultipleBranchPrices = async (req, res) => {
  try {
    const branchId = toInt(req.user?.branchId);
    const updatedBy = toInt(req.user?.id) || toInt(req.user?.employeeId);
    const updates = Array.isArray(req.body) ? req.body : [];

    if (!branchId) return res.status(401).json({ error: 'unauthorized' });
    if (updates.length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลอัปเดต' });

    const ops = updates.map((item) => {
      const pid = toInt(item?.product?.id || item?.productId);
      if (!pid) return null;
      const eff = item?.effectiveDate ? new Date(item.effectiveDate) : null;
      const exp = item?.expiredDate ? new Date(item.expiredDate) : null;
      return prisma.branchPrice.upsert({
        where: { productId_branchId: { productId: pid, branchId } },
        update: {
          costPrice: D(item.costPrice),
          priceRetail: D(item.retailPrice ?? item.priceRetail),
          priceWholesale: D(item.wholesalePrice ?? item.priceWholesale),
          priceTechnician: D(item.technicianPrice ?? item.priceTechnician),
          priceOnline: D(item.priceOnline),
          effectiveDate: eff,
          expiredDate: exp,
          note: item.note || null,
          isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
          updatedBy,
        },
        create: {
          productId: pid,
          branchId,
          costPrice: D(item.costPrice),
          priceRetail: D(item.retailPrice ?? item.priceRetail),
          priceWholesale: D(item.wholesalePrice ?? item.priceWholesale),
          priceTechnician: D(item.technicianPrice ?? item.priceTechnician),
          priceOnline: D(item.priceOnline),
          effectiveDate: eff,
          expiredDate: exp,
          note: item.note || null,
          isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
          updatedBy,
        },
      });
    }).filter(Boolean);

    await prisma.$transaction(ops, { timeout: 30000 });

    return res.json({ updated: ops.length });
  } catch (err) {
    console.error('❌ updateMultipleBranchPrices error:', err);
    return res.status(500).json({ error: 'อัปเดตราคาไม่สำเร็จ' });
  }
};

module.exports = {
  getActiveBranchPrice,
  upsertBranchPrice,
  getBranchPricesByBranch,
  getAllProductsWithBranchPrice,
  updateMultipleBranchPrices,
};
