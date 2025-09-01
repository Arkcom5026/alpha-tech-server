// 📦 controllers/branchPriceController.js — Prisma singleton, Decimal-safe, branch scope, robust date logic

const { prisma, Prisma } = require('../lib/prisma');

// Helpers
const D = (v) => (v instanceof Prisma.Decimal ? v : new Prisma.Decimal(v ?? 0));
const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

// ⚙️ pick only provided fields for partial update (avoid overwriting with 0)
const pickPriceUpdate = (src = {}) => {
  const out = {};
  if (src.costPrice !== undefined) out.costPrice = D(src.costPrice);
  if (src.priceRetail !== undefined || src.retailPrice !== undefined) out.priceRetail = D(src.retailPrice ?? src.priceRetail);
  if (src.priceWholesale !== undefined || src.wholesalePrice !== undefined) out.priceWholesale = D(src.wholesalePrice ?? src.priceWholesale);
  if (src.priceTechnician !== undefined || src.technicianPrice !== undefined) out.priceTechnician = D(src.technicianPrice ?? src.priceTechnician);
  if (src.priceOnline !== undefined) out.priceOnline = D(src.priceOnline);
  if (src.effectiveDate !== undefined) out.effectiveDate = src.effectiveDate ? new Date(src.effectiveDate) : null;
  if (src.expiredDate !== undefined) out.expiredDate = src.expiredDate ? new Date(src.expiredDate) : null;
  if (src.note !== undefined) out.note = src.note || null;
  if (typeof src.isActive === 'boolean') out.isActive = src.isActive;
  return out;
};

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
      // aliases (accept FE variations)
      retailPrice,
      wholesalePrice,
      technicianPrice,
    } = req.body || {};

    if (!branchId || !productId) {
      return res.status(400).json({ error: 'branchId หรือ productId ไม่ถูกต้อง' });
    }

    const pid = toInt(productId);
    const eff = effectiveDate ? new Date(effectiveDate) : null;
    const exp = expiredDate ? new Date(expiredDate) : null;

    // ⛔ validate date order
    if (eff && exp && exp < eff) {
      return res.status(400).json({ error: 'expiredDate ต้องไม่เร็วกว่าหรือก่อน effectiveDate' });
    }

    const result = await prisma.branchPrice.upsert({
      where: {
        productId_branchId: { productId: pid, branchId },
      },
      update: {
        ...pickPriceUpdate({
          costPrice,
          priceRetail,
          priceWholesale,
          priceTechnician,
          priceOnline,
          effectiveDate,
          expiredDate,
          note,
          isActive,
          // aliases
          retailPrice,
          wholesalePrice,
          technicianPrice,
        }),
        updatedBy,
      },
      create: {
        productId: pid,
        branchId,
        costPrice: D(costPrice),
        priceRetail: D(retailPrice ?? priceRetail),
        priceWholesale: D(wholesalePrice ?? priceWholesale),
        priceTechnician: D(technicianPrice ?? priceTechnician),
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
    const { categoryId, productTypeId, productProfileId, templateId, productTemplateId, searchText } = req.query || {};

    if (!branchId) return res.status(401).json({ error: 'unauthorized' });
    if (!searchText && !categoryId && !productTypeId && !productProfileId && !templateId && !productTemplateId) {
      return res.json([]);
    }

    const whereAND = [];
    const templateParam = toInt(templateId ?? productTemplateId);
    if (templateParam) whereAND.push({ templateId: templateParam });
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

    const ops = updates
      .map((item) => {
        const pid = toInt(item?.product?.id || item?.productId);
        if (!pid) return null;

        // validate date order if both provided
        const eff = item?.effectiveDate ? new Date(item.effectiveDate) : undefined;
        const exp = item?.expiredDate ? new Date(item.expiredDate) : undefined;
        if (eff && exp && exp < eff) {
          // skip invalid item; alternatively could throw
          return null;
        }

        const patch = pickPriceUpdate(item);
        patch.updatedBy = updatedBy;

        return prisma.branchPrice.upsert({
          where: { productId_branchId: { productId: pid, branchId } },
          update: patch,
          create: {
            productId: pid,
            branchId,
            costPrice: D(item.costPrice),
            priceRetail: D(item.retailPrice ?? item.priceRetail),
            priceWholesale: D(item.wholesalePrice ?? item.priceWholesale),
            priceTechnician: D(item.technicianPrice ?? item.priceTechnician),
            priceOnline: D(item.priceOnline),
            effectiveDate: item?.effectiveDate ? new Date(item.effectiveDate) : null,
            expiredDate: item?.expiredDate ? new Date(item.expiredDate) : null,
            note: item.note || null,
            isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
            updatedBy,
          },
        });
      })
      .filter(Boolean);

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
