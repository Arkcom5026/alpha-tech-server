// controllers/productTypeController.js
// Guards: slug-based unique-by-parent (categoryId), safer P2002 detail

const { prisma, Prisma } = require('../lib/prisma');
const MAX_LIMIT = 100;

// ---------- helpers ----------
const toInt = (v) =>
  v === undefined || v === null || v === '' ? undefined : parseInt(v, 10);
const omitUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

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

// Inline normalizer/slugify (ไม่พึ่ง external deps)
const toSpaces = (s) => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
const stripPunct = (s) => s.replace(/[^A-Za-z0-9ก-๙ .]/g, '');
function normalizeName(raw) {
  if (!raw) return '';
  let s = String(raw).normalize('NFC');
  s = toSpaces(stripPunct(s)).toLowerCase();
  return s;
}
function slugify(raw) {
  if (!raw) return '';
  const base = normalizeName(raw);
  return base.replace(/\./g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

const dedupeProductTypeDropdowns = (rows = []) => {
  const seen = new Set();
  const result = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    const name = String(row?.name ?? '').trim();
    if (!row?.id || !name) continue;

    const categoryKey = row?.categoryId == null ? 'none' : String(row.categoryId);
    const nameKey = String(row?.normalizedName || normalizeName(name)).trim().toLowerCase();
    const key = `${categoryKey}:${nameKey}`;

    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      id: row.id,
      name,
      categoryId: row.categoryId ?? null,
      branchId: row.branchId ?? null,
      globalProductTypeId: row.globalProductTypeId ?? null,
    });
  }

  return result;
};

// ---------- parent category guard ----------
async function getCategoryGuardInfo(categoryId) {
  if (!categoryId) return null;
  return prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, active: true, isSystem: true, name: true },
  });
}

// ---------- queries ----------
async function findDuplicateType({ branchId, categoryId, slug }) {
  if (!branchId || !categoryId || !slug) return null;
  return prisma.productType.findFirst({
    where: { branchId, categoryId, slug },
    select: { id: true, name: true, slug: true, pathCached: true },
  });
}

// ✅ GET: list
const getAllProductType = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;
    const { q, categoryId, includeInactive, page: pageQ, limit: limitQ } = req.query || {};
    const pageRaw = Number(pageQ);
    const limitRaw = Number(limitQ);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : 20;

    const where = omitUndefined({
      branchId,
      ...(q ? { name: { contains: String(q), mode: 'insensitive' } } : {}),
      ...(toInt(categoryId) ? { categoryId: toInt(categoryId) } : {}),
      ...((String(includeInactive || '').toLowerCase() === 'true') ? {} : { active: true }),
    });

    const [total, items] = await Promise.all([
      prisma.productType.count({ where }),
      prisma.productType.findMany({
        where,
        orderBy: [{ pathCached: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, name: true, slug: true, categoryId: true, active: true, pathCached: true, level: true, sortOrder: true, parentId: true, updatedAt: true },
      }),
    ]);
    return res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('❌ Get ProductType Failed:', err);
    return res.status(500).json({ error: 'ไม่สามารถดึงประเภทสินค้าได้' });
  }
};

const getProductTypeById = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const item = await prisma.productType.findFirst({
      where: { id, branchId },
      select: { id: true, name: true, slug: true, categoryId: true, active: true, pathCached: true, level: true, sortOrder: true, parentId: true, updatedAt: true },
    });
    if (!item) return res.status(404).json({ error: 'ไม่พบประเภทสินค้า' });
    return res.json(item);
  } catch (err) {
    console.error('❌ Get ProductType by id Failed:', err);
    return res.status(500).json({ error: 'ไม่สามารถดึงประเภทสินค้าได้' });
  }
};

const createProductType = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const categoryId = toInt(body.categoryId);
    if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อประเภทสินค้า' });
    if (!categoryId) return res.status(400).json({ error: 'กรุณาระบุหมวดหมู่สินค้า' });

    const cat = await getCategoryGuardInfo(categoryId);
    if (!cat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่สินค้า' });
    if (cat.active === false) return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'หมวดหมู่ถูกปิดการใช้งานอยู่ กรุณากู้คืนหมวดหมู่ก่อน' });

    const slug = slugify(name);
    const dup = await findDuplicateType({ branchId, categoryId, slug });
    if (dup) return res.status(409).json({ error: 'DUPLICATE_PRODUCT_TYPE', duplicate: dup });

    const item = await prisma.productType.create({
      data: omitUndefined({
        name,
        slug,
        normalizedName: normalizeName(name),
        categoryId,
        branchId,
        active: body.active === undefined ? true : Boolean(body.active),
        sortOrder: toInt(body.sortOrder) ?? 0,
      }),
      select: { id: true, name: true, slug: true, categoryId: true, active: true, pathCached: true, level: true, sortOrder: true, parentId: true },
    });
    return res.status(201).json(item);
  } catch (err) {
    console.error('❌ Create ProductType Failed:', err);
    if (err?.code === 'P2002') return res.status(409).json({ error: 'DUPLICATE_PRODUCT_TYPE', target: err?.meta?.target });
    return res.status(500).json({ error: 'ไม่สามารถสร้างประเภทสินค้าได้' });
  }
};

const updateProductType = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });
    const body = req.body || {};

    const current = await prisma.productType.findFirst({ where: { id, branchId }, select: { id: true, categoryId: true, name: true, slug: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบประเภทสินค้า' });

    const nextName = body.name === undefined ? current.name : String(body.name || '').trim();
    const nextCategoryId = body.categoryId === undefined ? current.categoryId : toInt(body.categoryId);
    if (!nextName) return res.status(400).json({ error: 'กรุณาระบุชื่อประเภทสินค้า' });
    if (!nextCategoryId) return res.status(400).json({ error: 'กรุณาระบุหมวดหมู่สินค้า' });

    const cat = await getCategoryGuardInfo(nextCategoryId);
    if (!cat) return res.status(404).json({ error: 'ไม่พบหมวดหมู่สินค้า' });
    if (cat.active === false) return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'หมวดหมู่ถูกปิดการใช้งานอยู่ กรุณากู้คืนหมวดหมู่ก่อน' });

    const nextSlug = slugify(nextName);
    if (nextCategoryId !== current.categoryId || nextSlug !== current.slug) {
      const dup = await findDuplicateType({ branchId, categoryId: nextCategoryId, slug: nextSlug });
      if (dup && dup.id !== id) return res.status(409).json({ error: 'DUPLICATE_PRODUCT_TYPE', duplicate: dup });
    }

    const item = await prisma.productType.update({
      where: { id },
      data: omitUndefined({
        name: nextName,
        slug: nextSlug,
        normalizedName: normalizeName(nextName),
        categoryId: nextCategoryId,
        active: body.active === undefined ? undefined : Boolean(body.active),
        sortOrder: toInt(body.sortOrder),
      }),
      select: { id: true, name: true, slug: true, categoryId: true, active: true, pathCached: true, level: true, sortOrder: true, parentId: true },
    });
    return res.json(item);
  } catch (err) {
    console.error('❌ Update ProductType Failed:', err);
    if (err?.code === 'P2002') return res.status(409).json({ error: 'DUPLICATE_PRODUCT_TYPE', target: err?.meta?.target });
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
    if (!current) return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการปิดใช้งาน' });

    if (current.active === false) {
      return res.json({ message: 'ประเภทสินค้านี้ถูกปิดใช้งานอยู่แล้ว', id });
    }

    await prisma.productType.update({ where: { id }, data: { active: false } });
    return res.json({ message: 'ปิดใช้งานประเภทสินค้าเรียบร้อย', id });
  } catch (err) {
    console.error('❌ ARCHIVE ProductType Failed:', err);
    return res.status(500).json({ error: 'ไม่สามารถปิดใช้งานประเภทสินค้าได้' });
  }
};

const restoreProductType = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const current = await prisma.productType.findFirst({ where: { id, branchId }, select: { id: true, active: true, categoryId: true, branchId: true } });
    if (!current) return res.status(404).json({ error: 'ไม่พบประเภทสินค้าที่ต้องการกู้คืน' });

    const cat = await getCategoryGuardInfo(current.categoryId);
    if (cat?.active === false) return res.status(409).json({ error: 'PARENT_INACTIVE', message: 'หมวดหมู่ถูกปิดการใช้งานอยู่ กรุณากู้คืนหมวดหมู่ก่อน' });

    if (current.active === true) {
      return res.json({ message: 'ประเภทสินค้านี้อยู่ในสถานะใช้งานแล้ว', id });
    }

    await prisma.productType.update({ where: { id }, data: { active: true } });
    return res.json({ message: 'กู้คืนประเภทสินค้าเรียบร้อย', id });
  } catch (err) {
    console.error('❌ RESTORE ProductType Failed:', err);
    return res.status(500).json({ error: 'ไม่สามารถกู้คืนประเภทสินค้าได้' });
  }
};

// ✅ dropdowns
const getProductTypeDropdowns = async (req, res) => {
  try {
    const branchId = requireBranchId(req, res);
    if (!branchId) return;

    const types = await prisma.productType.findMany({
      where: { active: true, branchId },
      select: {
        id: true,
        name: true,
        categoryId: true,
        branchId: true,
        normalizedName: true,
        globalProductTypeId: true,
      },
      orderBy: [{ categoryId: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    });

    res.set('Cache-Control', 'no-store');
    res.json(dedupeProductTypeDropdowns(types));
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
