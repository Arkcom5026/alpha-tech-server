// controllers/productTypeController.js
// Legacy route controller kept for /api/product-types compatibility.
// ProductType runtime identity is branchId + globalProductTypeId + normalizedName.
// ProductType does not own categoryId and does not use slug.

const { prisma, Prisma } = require('../lib/prisma');

const MAX_LIMIT = 100;

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
};

const omitUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined));

const normalizeName = (raw) =>
  String(raw || '')
    .normalize('NFC')
    .replace(/[^A-Za-z0-9ก-๙ .]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const getBranchIdFromReq = (req) => toInt(req.user?.branchId);

const requireBranchId = (req, res) => {
  const branchId = getBranchIdFromReq(req);
  if (!branchId) {
    res.status(403).json({
      error: 'BRANCH_REQUIRED',
      message: 'ไม่พบข้อมูลสาขาใน token กรุณาเข้าสู่ระบบใหม่',
    });
    return null;
  }
  return branchId;
};

const productTypeBrandInclude = {
  productTypeBrands: {
    select: {
      brandId: true,
      brand: {
        select: {
          id: true,
          name: true,
          active: true,
        },
      },
    },
  },
};

const productTypeRuntimeCountInclude = {
  _count: {
    select: {
      Product: true,
      productTypeBrands: true,
    },
  },
};

const globalProductTypeInclude = {
  globalProductType: {
    select: {
      id: true,
      name: true,
      categoryId: true,
      category: { select: { id: true, name: true, active: true } },
    },
  },
};

const mapProductTypeOption = (type) => {
  const typeBrands = (Array.isArray(type?.productTypeBrands) ? type.productTypeBrands : [])
    .map((row) => {
      const brand = row?.brand;
      if (!brand?.id || !brand?.name || brand.active === false) return null;
      return {
        id: brand.id,
        name: brand.name,
        brandId: row?.brandId ?? brand.id,
      };
    })
    .filter(Boolean);

  return {
    id: type.id,
    name: type.name,
    active: type.active,
    isActive: type.active,
    branchId: type.branchId,
    categoryId: type.globalProductType?.categoryId ?? null,
    globalProductTypeId: type.globalProductTypeId,
    globalProductType: type.globalProductType || null,
    productCount: Number(type?._count?.Product ?? type?.productCount ?? 0),
    brandCount: Number(type?._count?.productTypeBrands ?? typeBrands.length ?? 0),
    brandOptions: typeBrands,
    brands: typeBrands,
    typeBrands,
    createdAt: type.createdAt,
    updatedAt: type.updatedAt,
  };
};

const dedupeByRuntimeKey = (items = []) => {
  const seen = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.id) continue;
    const key = `${item.globalProductTypeId || 'none'}:${normalizeName(item.name)}`;
    const existing = seen.get(key);
    if (!existing || (existing.active === false && item.active !== false) || Number(item.id) < Number(existing.id)) {
      seen.set(key, item);
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    const nameCompare = String(a.name || '').localeCompare(String(b.name || ''), 'th');
    if (nameCompare !== 0) return nameCompare;
    return Number(a.id) - Number(b.id);
  });
};

const makeProductTypeReadWhere = ({ branchId, q, globalProductTypeId, categoryId, includeInactive }) => {
  const gptId = toInt(globalProductTypeId);
  const catId = toInt(categoryId);

  return omitUndefined({
    ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
    ...(gptId ? { globalProductTypeId: gptId } : {}),
    ...(catId ? { globalProductType: { categoryId: catId } } : {}),
    ...((String(includeInactive || '').toLowerCase() === 'true') ? {} : { active: true }),
    ...(branchId ? { branchId } : {}),
  });
};

const findDuplicateType = ({ branchId, globalProductTypeId, normalizedName, excludeId }) => {
  if (!branchId || !globalProductTypeId || !normalizedName) return null;

  return prisma.productType.findFirst({
    where: {
      branchId,
      globalProductTypeId,
      normalizedName,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      name: true,
      branchId: true,
      globalProductTypeId: true,
      normalizedName: true,
    },
  });
};

const requireGlobalProductType = async (globalProductTypeId, res) => {
  const gptId = toInt(globalProductTypeId);
  if (!gptId) {
    res.status(400).json({
      error: 'GLOBAL_PRODUCT_TYPE_REQUIRED',
      message: 'กรุณาระบุ GlobalProductType สำหรับประเภทสินค้านี้',
    });
    return null;
  }

  const globalProductType = await prisma.globalProductType.findFirst({
    where: { id: gptId, active: true },
    select: { id: true, name: true, categoryId: true },
  });

  if (!globalProductType?.id) {
    res.status(400).json({
      error: 'INVALID_GLOBAL_PRODUCT_TYPE',
      message: 'GlobalProductType ไม่ถูกต้องหรือถูกปิดใช้งานอยู่',
    });
    return null;
  }

  return globalProductType;
};

const getAllProductType = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const { q, search, categoryId, globalProductTypeId, includeInactive, page: pageQ, limit: limitQ } = req.query || {};
    const pageRaw = Number(pageQ);
    const limitRaw = Number(limitQ);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 20;

    const where = makeProductTypeReadWhere({
      branchId,
      q: q || search,
      categoryId,
      globalProductTypeId,
      includeInactive,
    });

    const [total, items] = await Promise.all([
      prisma.productType.count({ where }),
      prisma.productType.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: { ...globalProductTypeInclude, ...productTypeBrandInclude, ...productTypeRuntimeCountInclude },
      }),
    ]);

    res.set('Cache-Control', 'no-store');
    res.json({ items: items.map(mapProductTypeOption), total, page, limit });
  } catch (err) {
    console.error('❌ GET ProductTypes Failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

const getProductTypeById = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const productType = await prisma.productType.findFirst({
      where: { id, branchId },
      include: { ...globalProductTypeInclude, ...productTypeBrandInclude, ...productTypeRuntimeCountInclude },
    });

    if (!productType) return res.status(404).json({ error: 'ไม่พบประเภทสินค้านี้' });
    res.json(mapProductTypeOption(productType));
  } catch (err) {
    console.error('❌ getProductTypeById error:', err);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลประเภทสินค้าได้' });
  }
};

const createProductType = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const { name, globalProductTypeId } = req.body || {};
    const nameTrim = String(name || '').trim();
    if (!nameTrim) return res.status(400).json({ error: 'กรุณาระบุชื่อประเภทสินค้า' });

    const globalProductType = await requireGlobalProductType(globalProductTypeId, res);
    if (!globalProductType) return;

    const normalizedName = normalizeName(nameTrim);
    const duplicate = await findDuplicateType({
      branchId,
      globalProductTypeId: globalProductType.id,
      normalizedName,
    });

    if (duplicate?.id) {
      return res.status(409).json({ error: 'DUPLICATE', message: 'พบรายการเดิม', conflict: duplicate });
    }

    const created = await prisma.productType.create({
      data: {
        name: nameTrim,
        normalizedName,
        branchId,
        globalProductTypeId: globalProductType.id,
        active: true,
      },
      include: { ...globalProductTypeInclude, ...productTypeBrandInclude, ...productTypeRuntimeCountInclude },
    });

    res.status(201).json(mapProductTypeOption(created));
  } catch (err) {
    console.error('❌ CREATE ProductType Failed:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'DUPLICATE', message: 'พบรายการเดิม (unique constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถเพิ่มประเภทสินค้าได้' });
  }
};

const updateProductType = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productType.findFirst({
      where: { id, branchId },
      select: { id: true, name: true, branchId: true, globalProductTypeId: true },
    });
    if (!current) return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการอัปเดต' });

    const { name, globalProductTypeId } = req.body || {};

    const nextName = name !== undefined ? String(name || '').trim() : current.name;
    if (!nextName) return res.status(400).json({ error: 'ชื่อประเภทสินค้าต้องไม่ว่าง' });

    let nextGlobalProductTypeId = current.globalProductTypeId;
    if (globalProductTypeId !== undefined) {
      const globalProductType = await requireGlobalProductType(globalProductTypeId, res);
      if (!globalProductType) return;
      nextGlobalProductTypeId = globalProductType.id;
    }

    const normalizedName = normalizeName(nextName);
    const duplicate = await findDuplicateType({
      branchId,
      globalProductTypeId: nextGlobalProductTypeId,
      normalizedName,
      excludeId: id,
    });

    if (duplicate?.id) {
      return res.status(409).json({ error: 'DUPLICATE', message: 'พบรายการเดิม', conflict: duplicate });
    }

    const data = omitUndefined({
      name: nextName !== current.name ? nextName : undefined,
      normalizedName,
      globalProductTypeId: nextGlobalProductTypeId !== current.globalProductTypeId ? nextGlobalProductTypeId : undefined,
    });

    const updated = await prisma.productType.update({
      where: { id },
      data,
      include: { ...globalProductTypeInclude, ...productTypeBrandInclude, ...productTypeRuntimeCountInclude },
    });

    res.json(mapProductTypeOption(updated));
  } catch (err) {
    console.error('❌ UPDATE ProductType Failed:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'DUPLICATE', message: 'พบรายการเดิม (unique constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถแก้ไขประเภทสินค้าได้' });
  }
};

const archiveProductType = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productType.findFirst({ where: { id, branchId }, select: { id: true, active: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการปิดการใช้งาน' });

    const usedByProduct = await prisma.product.findFirst({ where: { productTypeId: id }, select: { id: true } });
    if (usedByProduct) {
      return res.status(409).json({
        error: 'HAS_REFERENCES',
        message: 'ไม่สามารถปิดการใช้งานได้ เนื่องจากมีสินค้าอ้างอิงอยู่',
      });
    }

    if (current.active === false) return res.json({ message: 'ประเภทสินค้านี้ถูกปิดใช้งานอยู่แล้ว', id });

    await prisma.productType.update({ where: { id }, data: { active: false } });
    return res.json({ message: 'ปิดการใช้งานประเภทสินค้าเรียบร้อย', id });
  } catch (err) {
    console.error('❌ ARCHIVE ProductType Failed:', err);
    return res.status(500).json({ error: 'ไม่สามารถปิดการใช้งานประเภทสินค้าได้' });
  }
};

const restoreProductType = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productType.findFirst({ where: { id, branchId }, select: { id: true, active: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการกู้คืน' });

    if (current.active === true) return res.json({ message: 'ประเภทสินค้านี้อยู่ในสถานะใช้งานแล้ว', id });

    await prisma.productType.update({ where: { id }, data: { active: true } });
    return res.json({ message: 'กู้คืนประเภทสินค้าเรียบร้อย', id });
  } catch (err) {
    console.error('❌ RESTORE ProductType Failed:', err);
    return res.status(500).json({ error: 'ไม่สามารถกู้คืนประเภทสินค้าได้' });
  }
};

const getProductTypeDropdowns = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const types = await prisma.productType.findMany({
      where: { active: true, branchId },
      select: {
        id: true,
        name: true,
        active: true,
        branchId: true,
        globalProductTypeId: true,
        globalProductType: { select: { id: true, name: true, categoryId: true } },
        ...productTypeBrandInclude,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

    res.set('Cache-Control', 'no-store');
    res.json(dedupeByRuntimeKey(types).map(mapProductTypeOption));
  } catch (err) {
    console.error('❌ getProductTypeDropdowns error:', err);
    res.status(500).json({ error: 'Failed to load product types' });
  }
};

module.exports = {
  getAllProductType,
  getProductTypeById,
  createProductType,
  updateProductType,
  archiveProductType,
  restoreProductType,
  getProductTypeDropdowns,
};
