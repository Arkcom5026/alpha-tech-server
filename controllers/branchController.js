
// controllers/branchController.js — Prisma singleton, safer errors, map to *existing schema* (province/district strings + subdistrict relation). No lat/lng from FE.

const { prisma, Prisma } = require('../lib/prisma');

const toInt = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const getStr = (v) => (v === null || v === undefined ? '' : String(v).trim());
const compact = (obj) => { const out = {}; for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v; return out; };

// Normalize incoming body (accept old/new keys). FE sends codes; BE schema stores province/district as strings; subdistrict is a relation.
function normalizeBranchBody(body = {}) {
  const out = {
    name: getStr(body.name),
    address: getStr(body.address),
    phone: getStr(body.phone),
    subdistrictCode: getStr(body.subdistrictCode) || getStr(body.subdistrict_id) || getStr(body.subdistrictId) || getStr(body.subdistrict),
    // ให้ DB ใช้ default(true) ถ้าไม่ส่งมา
    RBACEnabled: (typeof body.RBACEnabled === 'boolean') ? body.RBACEnabled : undefined,
  };
  return out;
}

// Build a partial update object for prisma.branch.update
function buildPartialUpdate(body = {}) {
  const n = normalizeBranchBody(body);
  const has = (key, ...aliases) => [key, ...aliases].some((k) => Object.prototype.hasOwnProperty.call(body, k));
  const data = {};
  if (has('name')) data.name = n.name;
  if (has('address')) data.address = n.address;
  if (has('phone')) data.phone = n.phone || null;
  if (has('RBACEnabled')) data.RBACEnabled = n.RBACEnabled;

  // subdistrict relation (connect by unique `code` if provided)
  if (has('subdistrictCode', 'subdistrict_id', 'subdistrictId', 'subdistrict')) {
    if (n.subdistrictCode) {
      data.subdistrict = { connect: { code: n.subdistrictCode } };
    } else {
      data.subdistrict = { disconnect: true };
    }
  }
  return data;
}

// GET /branches
// Helper include tree for address hydration
const ADDRESS_INCLUDE = {
  subdistrict: {
    select: {
      code: true,
      nameTh: true,
      postcode: true,
      district: {
        select: {
          code: true,
          nameTh: true,
          province: { select: { code: true, nameTh: true, region: true } },
        },
      },
    },
  },
};

// Compose FE-friendly address fields
function hydrateBranchAddress(b) {
  const s = b?.subdistrict;
  const d = s?.district;
  const p = d?.province;
  const out = { ...b };
  out.subdistrictCode = s?.code ? String(s.code) : undefined;
  out.subdistrictName = s?.nameTh ?? undefined;
  out.postalCode = s?.postcode != null ? String(s.postcode) : undefined;
  out.districtCode = d?.code ? String(d.code) : undefined;
  out.districtName = d?.nameTh ?? undefined;
  out.provinceCode = p?.code ? String(p.code) : undefined;
  out.provinceName = p?.nameTh ?? undefined;
  out.region = p?.region ?? undefined;
  const parts = [];
  if (out.subdistrictName) parts.push('ตำบล' + out.subdistrictName);
  if (out.districtName) parts.push('อำเภอ' + out.districtName);
  if (out.provinceName) parts.push('จังหวัด' + out.provinceName);
  if (out.postalCode) parts.push(String(out.postalCode));
  out.fullAddress = parts.join(' ').trim();
  return out;
}

const getAllBranches = async (req, res) => {
  try {
    const rows = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: ADDRESS_INCLUDE,
    });
    return res.json(rows.map(hydrateBranchAddress));
  } catch (err) {
    console.error('❌ [getAllBranches] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลสาขาได้' });
  }
};

// GET /branches/:id — include subdistrict relation and hydrate codes for FE
const getBranchById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.branch.findUnique({
      where: { id },
      include: ADDRESS_INCLUDE,
    });
    if (!row) return res.status(404).json({ error: 'ไม่พบสาขา' });
    return res.json(hydrateBranchAddress(row));
  } catch (err) {
    console.error('❌ [getBranchById] error:', err);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลสาขาได้' });
  }
};

// POST /branches — map codes to existing columns and connect subdistrict relation
const createBranch = async (req, res) => {
  const BASE_BRANCH_ID = 2; // branch template for cloning prices
  try {
    const n = normalizeBranchBody(req.body || {});

    if (!n.name) return res.status(400).json({ error: 'กรุณากรอกชื่อสาขา' });
    if (!n.address) return res.status(400).json({ error: 'กรุณากรอกที่อยู่สาขา' });

    const data = compact({
      name: n.name,
      address: n.address,
      phone: n.phone || null,
      RBACEnabled: n.RBACEnabled,
      // relation only (single source of truth)
      subdistrict: n.subdistrictCode ? { connect: { code: n.subdistrictCode } } : undefined,
    });

    const created = await prisma.branch.create({ data });

    // Clone prices from base branch (best-effort)
    try {
      const basePrices = await prisma.branchPrice.findMany({ where: { branchId: BASE_BRANCH_ID } });
      if (basePrices.length > 0) {
        await prisma.branchPrice.createMany({
          data: basePrices.map((item) => ({
            productId: item.productId,
            branchId: created.id,
            isActive: true,
            costPrice: item.costPrice,
            priceRetail: item.priceRetail,
            priceOnline: item.priceOnline,
            priceTechnician: item.priceTechnician,
            priceWholesale: item.priceWholesale,
          })),
          skipDuplicates: true,
        });
      }
      return res.status(201).json({ ...created });
    } catch (cloneErr) {
      console.warn('⚠️ [createBranch] Clone branchPrice error:', cloneErr);
      return res.status(201).json({ ...created, clonedPrices: 0, cloneWarning: 'Clone ราคาสำเร็จบางส่วน หรือไม่สมบูรณ์' });
    }
  } catch (err) {
    console.error('❌ [createBranch] error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'ชื่อสาขาซ้ำ (unique constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถสร้างสาขาได้' });
  }
};

// PATCH /branches/:id — partial update using existing columns + relation connect
const updateBranch = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const data = buildPartialUpdate(req.body || {});
    if (!Object.keys(data).length) return res.status(400).json({ error: 'ไม่มีข้อมูลสำหรับอัปเดต' });

    const updated = await prisma.branch.update({ where: { id }, data });
    return res.json(updated);
  } catch (err) {
    console.error('❌ [updateBranch] error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'ไม่พบสาขาที่ต้องการอัปเดต' });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return res.status(409).json({ error: 'ชื่อสาขาซ้ำ (unique constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถอัปเดตสาขาได้' });
  }
};

// DELETE /branches/:id
const deleteBranch = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    await prisma.branch.delete({ where: { id } });
    return res.json({ message: 'ลบสาขาสำเร็จ' });
  } catch (err) {
    console.error('❌ [deleteBranch] error:', err);
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'ไม่พบสาขาที่ต้องการลบ' });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return res.status(409).json({ error: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถลบสาขาได้' });
  }
};

module.exports = {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
};

