// 📦 controllers/branchPriceController.js — Prisma singleton, Decimal-safe, branch scope
const { prisma, Prisma } = require('../lib/prisma');

const D = (value) => (
  value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value ?? 0)
);

const toInt = (value) => (
  value === undefined || value === null || value === ''
    ? undefined
    : Number(value)
);

const getBranchId = (req) => toInt(req.user?.branchId);
const getEmployeeId = (req) => toInt(req.user?.employeeId);

const requireWriteActor = (req, res) => {
  const branchId = getBranchId(req);
  const employeeId = getEmployeeId(req);

  if (!branchId) {
    res.status(403).json({
      code: 'BRANCH_CONTEXT_REQUIRED',
      error: 'ไม่พบสาขาของพนักงานผู้ทำรายการ',
    });
    return null;
  }

  if (!employeeId) {
    res.status(403).json({
      code: 'EMPLOYEE_CONTEXT_REQUIRED',
      error: 'ไม่พบข้อมูลพนักงานผู้ทำรายการ',
    });
    return null;
  }

  return { branchId, employeeId };
};

const pickPriceUpdate = (source = {}) => {
  const update = {};

  if (source.costPrice !== undefined) update.costPrice = D(source.costPrice);
  if (source.priceRetail !== undefined || source.retailPrice !== undefined) {
    update.priceRetail = D(source.retailPrice ?? source.priceRetail);
  }
  if (source.priceWholesale !== undefined || source.wholesalePrice !== undefined) {
    update.priceWholesale = D(source.wholesalePrice ?? source.priceWholesale);
  }
  if (source.priceTechnician !== undefined || source.technicianPrice !== undefined) {
    update.priceTechnician = D(source.technicianPrice ?? source.priceTechnician);
  }
  if (source.priceOnline !== undefined) update.priceOnline = D(source.priceOnline);
  if (source.effectiveDate !== undefined) {
    update.effectiveDate = source.effectiveDate ? new Date(source.effectiveDate) : null;
  }
  if (source.expiredDate !== undefined) {
    update.expiredDate = source.expiredDate ? new Date(source.expiredDate) : null;
  }
  if (source.note !== undefined) update.note = source.note || null;
  if (typeof source.isActive === 'boolean') update.isActive = source.isActive;

  return update;
};

const validateDateOrder = (effectiveDate, expiredDate) => {
  const effective = effectiveDate ? new Date(effectiveDate) : null;
  const expired = expiredDate ? new Date(expiredDate) : null;

  return {
    effective,
    expired,
    valid: !(effective && expired && expired < effective),
  };
};

// GET /branch-prices/active/:productId
const getActiveBranchPrice = async (req, res) => {
  try {
    const productId = toInt(req.params?.productId);
    const branchId = getBranchId(req);
    const now = new Date();

    if (!productId || !branchId) {
      return res.status(400).json({ message: 'productId หรือ branchId ไม่ถูกต้อง' });
    }

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
  } catch (error) {
    console.error('❌ getActiveBranchPrice error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// POST /branch-prices/upsert
const upsertBranchPrice = async (req, res) => {
  try {
    const actor = requireWriteActor(req, res);
    if (!actor) return undefined;

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
      retailPrice,
      wholesalePrice,
      technicianPrice,
    } = req.body || {};

    const productIdValue = toInt(productId);
    if (!productIdValue) {
      return res.status(400).json({ error: 'productId ไม่ถูกต้อง' });
    }

    if (costPrice === undefined || costPrice === null || Number(costPrice) <= 0) {
      return res.status(400).json({ error: 'กรุณาระบุราคาทุน' });
    }

    const retailValue = retailPrice ?? priceRetail;
    if (retailValue === undefined || retailValue === null || Number(retailValue) <= 0) {
      return res.status(400).json({ error: 'กรุณาระบุราคาขายปลีก' });
    }

    const dates = validateDateOrder(effectiveDate, expiredDate);
    if (!dates.valid) {
      return res.status(400).json({ error: 'expiredDate ต้องไม่เร็วกว่าหรือก่อน effectiveDate' });
    }

    const pricePatch = pickPriceUpdate({
      costPrice,
      priceRetail,
      priceWholesale,
      priceTechnician,
      priceOnline,
      effectiveDate,
      expiredDate,
      note,
      isActive,
      retailPrice,
      wholesalePrice,
      technicianPrice,
    });

    const result = await prisma.branchPrice.upsert({
      where: {
        productId_branchId: {
          productId: productIdValue,
          branchId: actor.branchId,
        },
      },
      update: {
        ...pricePatch,
        updatedBy: actor.employeeId,
      },
      create: {
        productId: productIdValue,
        branchId: actor.branchId,
        costPrice: D(costPrice),
        priceRetail: D(retailValue),
        priceWholesale: D(wholesalePrice ?? priceWholesale),
        priceTechnician: D(technicianPrice ?? priceTechnician),
        priceOnline: D(priceOnline),
        effectiveDate: dates.effective,
        expiredDate: dates.expired,
        note: note || null,
        isActive: typeof isActive === 'boolean' ? isActive : true,
        updatedBy: actor.employeeId,
      },
    });

    return res.json(result);
  } catch (error) {
    console.error('❌ upsertBranchPrice error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(400).json({ error: 'อ้างอิง product/branch/employee ไม่ถูกต้อง' });
    }
    return res.status(500).json({ error: 'ไม่สามารถบันทึกราคาได้' });
  }
};

const buildProductWhere = ({
  branchId,
  categoryId,
  productTypeId,
  productProfileId,
  templateId,
  productTemplateId,
  productId,
  searchText,
  q,
  includeInactive,
}) => {
  if (productProfileId) {
    return { error: { error: 'UNSUPPORTED_LEGACY_FILTER', field: 'productProfileId' } };
  }

  const AND = [{ productType: { branchId } }];
  const templateProductId = toInt(templateId ?? productTemplateId);

  if (templateProductId) AND.push({ templateProductId });
  if (productTypeId) AND.push({ productTypeId: toInt(productTypeId) });
  if (productId) AND.push({ id: toInt(productId) });
  if (categoryId) {
    AND.push({
      productType: {
        branchId,
        globalProductType: { categoryId: toInt(categoryId) },
      },
    });
  }

  const text = String(searchText ?? q ?? '').trim();
  if (text) AND.push({ name: { contains: text, mode: 'insensitive' } });

  const includeInactiveFlag = String(includeInactive).toLowerCase() === 'true'
    || String(includeInactive) === '1';
  if (!includeInactiveFlag) AND.push({ active: true });

  return { where: { AND } };
};

const productSelect = {
  id: true,
  name: true,
  mode: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  templateProductId: true,
  productType: {
    select: {
      id: true,
      name: true,
      globalProductType: {
        select: {
          categoryId: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  },
  brand: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true } },
  templateProduct: { select: { id: true, name: true } },
};

const projectProductsWithPrices = async (products, branchId) => {
  const productIds = products.map((product) => product.id);
  const prices = productIds.length
    ? await prisma.branchPrice.findMany({
        where: { branchId, productId: { in: productIds } },
      })
    : [];

  const priceMap = new Map(prices.map((price) => [price.productId, price]));

  return products.map((product) => ({
    product: {
      ...product,
      categoryId: product.productType?.globalProductType?.categoryId ?? null,
      category: product.productType?.globalProductType?.category ?? null,
      model: null,
      description: null,
      spec: null,
      templateId: product.templateProductId ?? null,
      template: product.templateProduct || null,
    },
    branchPrice: priceMap.get(product.id) || null,
  }));
};

// GET /branch-prices
const getBranchPricesByBranch = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const hasFilter = req.query?.searchText
      || req.query?.categoryId
      || req.query?.productTypeId
      || req.query?.templateId
      || req.query?.productTemplateId;

    if (!hasFilter) return res.json([]);

    const built = buildProductWhere({ branchId, ...req.query, includeInactive: false });
    if (built.error) return res.status(400).json(built.error);

    const products = await prisma.product.findMany({
      where: built.where,
      orderBy: { name: 'asc' },
      select: productSelect,
    });

    return res.json(await projectProductsWithPrices(products, branchId));
  } catch (error) {
    console.error('❌ getBranchPricesByBranch error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายการราคาได้' });
  }
};

// GET /branch-prices/products
const getAllProductsWithBranchPrice = async (req, res) => {
  try {
    const branchId = getBranchId(req);
    if (!branchId) return res.status(401).json({ error: 'unauthorized' });

    const {
      page,
      pageSize,
      sort,
      withMeta,
      ...filters
    } = req.query || {};

    const hasAnyFilter = filters.searchText
      || filters.q
      || filters.categoryId
      || filters.productTypeId
      || filters.templateId
      || filters.productTemplateId
      || filters.productId;

    if (!hasAnyFilter && !page && !pageSize) return res.json([]);

    const built = buildProductWhere({ branchId, ...filters });
    if (built.error) return res.status(400).json(built.error);

    const allowedSortFields = new Set(['name', 'id', 'createdAt', 'updatedAt']);
    let orderBy = { name: 'asc' };

    if (sort && typeof sort === 'string') {
      const [field, direction] = String(sort).split(':');
      if (allowedSortFields.has(field)) {
        orderBy = { [field]: String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc' };
      }
    }

    const currentPage = Math.max(0, toInt(page) || 0);
    const size = Math.min(200, Math.max(0, toInt(pageSize) || 0));
    const usePaging = currentPage > 0 && size > 0;
    const total = usePaging ? await prisma.product.count({ where: built.where }) : undefined;

    const products = await prisma.product.findMany({
      where: built.where,
      orderBy,
      select: productSelect,
      ...(usePaging ? { skip: (currentPage - 1) * size, take: size } : {}),
    });

    const items = await projectProductsWithPrices(products, branchId);
    if (usePaging && typeof total === 'number') res.set('X-Total-Count', String(total));

    const wantMeta = String(withMeta).toLowerCase() === 'true' || String(withMeta) === '1';
    if (wantMeta && usePaging) {
      return res.json({ items, total, page: currentPage, pageSize: size });
    }

    return res.json(items);
  } catch (error) {
    console.error('❌ getAllProductsWithBranchPrice error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดรายการสินค้าได้' });
  }
};

// PATCH /branch-prices/bulk
const updateMultipleBranchPrices = async (req, res) => {
  try {
    const actor = requireWriteActor(req, res);
    if (!actor) return undefined;

    const updates = Array.isArray(req.body) ? req.body : [];
    if (updates.length === 0) {
      return res.status(400).json({ error: 'ไม่มีข้อมูลอัปเดต' });
    }

    const operations = updates
      .map((item) => {
        const productId = toInt(item?.product?.id || item?.productId);
        if (!productId) return null;

        const dates = validateDateOrder(item?.effectiveDate, item?.expiredDate);
        if (!dates.valid) return null;

        return prisma.branchPrice.upsert({
          where: {
            productId_branchId: {
              productId,
              branchId: actor.branchId,
            },
          },
          update: {
            ...pickPriceUpdate(item),
            updatedBy: actor.employeeId,
          },
          create: {
            productId,
            branchId: actor.branchId,
            costPrice: D(item.costPrice),
            priceRetail: D(item.retailPrice ?? item.priceRetail),
            priceWholesale: D(item.wholesalePrice ?? item.priceWholesale),
            priceTechnician: D(item.technicianPrice ?? item.priceTechnician),
            priceOnline: D(item.priceOnline),
            effectiveDate: dates.effective,
            expiredDate: dates.expired,
            note: item.note || null,
            isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
            updatedBy: actor.employeeId,
          },
        });
      })
      .filter(Boolean);

    await prisma.$transaction(operations, { timeout: 30000 });
    return res.json({ updated: operations.length });
  } catch (error) {
    console.error('❌ updateMultipleBranchPrices error:', error);
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
