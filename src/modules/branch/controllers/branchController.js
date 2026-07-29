'use strict';

const { prisma, Prisma } = require('../../../../lib/prisma');
const featurePresets = require('../constants/branchFeaturePresets');

const BASE_BRANCH_ID = 2;

const toInt = (value) => (
  value === undefined || value === null || value === '' ? undefined : Number(value)
);

const getStr = (value) => (
  value === null || value === undefined ? '' : String(value).trim()
);

const compact = (value) => {
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) output[key] = item;
  }
  return output;
};

const normalizeBranchBody = (body = {}) => ({
  name: getStr(body.name),
  address: getStr(body.address),
  phone: getStr(body.phone),
  slug: getStr(body.slug).toLowerCase().replace(/\s+/g, '') || undefined,
  subdistrictCode: getStr(body.subdistrictCode)
    || getStr(body.subdistrict_id)
    || getStr(body.subdistrictId)
    || getStr(body.subdistrict),
  businessType: getStr(body.businessType).toUpperCase() || undefined,
  features: body.features && typeof body.features === 'object' ? body.features : undefined,
  RBACEnabled: typeof body.RBACEnabled === 'boolean' ? body.RBACEnabled : undefined,
});

const buildPartialUpdate = (body = {}) => {
  const normalized = normalizeBranchBody(body);
  const has = (key, ...aliases) => [key, ...aliases]
    .some((candidate) => Object.prototype.hasOwnProperty.call(body, candidate));
  const data = {};

  if (has('name')) data.name = normalized.name;
  if (has('address')) data.address = normalized.address;
  if (has('phone')) data.phone = normalized.phone || null;
  if (has('slug')) data.slug = normalized.slug || null;
  if (has('RBACEnabled')) data.RBACEnabled = normalized.RBACEnabled;
  if (has('businessType') && normalized.businessType) data.businessType = normalized.businessType;
  if (has('features')) {
    data.features = normalized.features !== undefined ? normalized.features : Prisma.JsonNull;
  }

  if (has('subdistrictCode', 'subdistrict_id', 'subdistrictId', 'subdistrict')) {
    data.subdistrict = normalized.subdistrictCode
      ? { connect: { code: normalized.subdistrictCode } }
      : { disconnect: true };
  }

  return data;
};

const ADDRESS_INCLUDE = Object.freeze({
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
});

const hydrateBranchAddress = (branch) => {
  const subdistrict = branch?.subdistrict;
  const district = subdistrict?.district;
  const province = district?.province;
  const output = { ...branch };

  output.subdistrictCode = subdistrict?.code ? String(subdistrict.code) : undefined;
  output.subdistrictName = subdistrict?.nameTh ?? undefined;
  output.postalCode = subdistrict?.postcode != null ? String(subdistrict.postcode) : undefined;
  output.districtCode = district?.code ? String(district.code) : undefined;
  output.districtName = district?.nameTh ?? undefined;
  output.provinceCode = province?.code ? String(province.code) : undefined;
  output.provinceName = province?.nameTh ?? undefined;
  output.region = province?.region ?? undefined;

  const addressParts = [];
  if (output.subdistrictName) addressParts.push(`ตำบล${output.subdistrictName}`);
  if (output.districtName) addressParts.push(`อำเภอ${output.districtName}`);
  if (output.provinceName) addressParts.push(`จังหวัด${output.provinceName}`);
  if (output.postalCode) addressParts.push(String(output.postalCode));
  output.fullAddress = addressParts.join(' ').trim();

  return output;
};

const getAllBranches = async (_req, res) => {
  try {
    const rows = await prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: ADDRESS_INCLUDE,
    });
    return res.json(rows.map(hydrateBranchAddress));
  } catch (error) {
    console.error('❌ [getAllBranches] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลสาขาได้' });
  }
};

const getBranchBySlug = async (req, res) => {
  try {
    const slug = getStr(req.params.slug).toLowerCase();
    if (!slug) return res.status(400).json({ error: 'กรุณาระบุชื่อย่อร้านค้า (slug)' });

    const row = await prisma.branch.findUnique({
      where: { slug },
      include: ADDRESS_INCLUDE,
    });

    if (!row) return res.status(404).json({ error: 'ไม่พบร้านค้าพาร์ตเนอร์ที่ระบุในระบบ' });
    return res.json(hydrateBranchAddress(row));
  } catch (error) {
    console.error('❌ [getBranchBySlug] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลโปรไฟล์พาร์ตเนอร์ได้' });
  }
};

const getBranchById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const row = await prisma.branch.findUnique({
      where: { id },
      include: ADDRESS_INCLUDE,
    });
    if (!row) return res.status(404).json({ error: 'ไม่พบสาขา' });
    return res.json(hydrateBranchAddress(row));
  } catch (error) {
    console.error('❌ [getBranchById] error:', error);
    return res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลสาขาได้' });
  }
};

const createBranch = async (req, res) => {
  try {
    const normalized = normalizeBranchBody(req.body || {});

    if (!normalized.name) return res.status(400).json({ error: 'กรุณากรอกชื่อสาขา' });
    if (!normalized.address) return res.status(400).json({ error: 'กรุณากรอกที่อยู่สาขา' });

    if (normalized.businessType && !normalized.features) {
      const preset = featurePresets[normalized.businessType];
      if (preset) normalized.features = preset;
    }

    const data = compact({
      name: normalized.name,
      address: normalized.address,
      phone: normalized.phone || null,
      slug: normalized.slug || null,
      RBACEnabled: normalized.RBACEnabled,
      businessType: normalized.businessType,
      features: normalized.features,
      subdistrict: normalized.subdistrictCode
        ? { connect: { code: normalized.subdistrictCode } }
        : undefined,
    });

    const created = await prisma.branch.create({ data });

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
    } catch (cloneError) {
      console.warn('⚠️ [createBranch] Clone branchPrice error:', cloneError);
      return res.status(201).json({
        ...created,
        clonedPrices: 0,
        cloneWarning: 'Clone ราคาสำเร็จบางส่วน หรือไม่สมบูรณ์',
      });
    }
  } catch (error) {
    console.error('❌ [createBranch] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'ชื่อสาขาหรือชื่อย่อ URL (slug) ซ้ำกับระบบอื่น' });
    }
    return res.status(500).json({ error: 'ไม่สามารถสร้างสาขาได้' });
  }
};

const updateBranch = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    const body = req.body || {};
    if (
      Object.prototype.hasOwnProperty.call(body, 'businessType')
      && !Object.prototype.hasOwnProperty.call(body, 'features')
    ) {
      const businessType = getStr(body.businessType).toUpperCase();
      const preset = featurePresets[businessType];
      if (preset) body.features = preset;
    }

    const data = buildPartialUpdate(body);
    if (!Object.keys(data).length) {
      return res.status(400).json({ error: 'ไม่มีข้อมูลสำหรับอัปเดต' });
    }

    const updated = await prisma.branch.update({
      where: { id },
      data,
      include: ADDRESS_INCLUDE,
    });
    return res.json(hydrateBranchAddress(updated));
  } catch (error) {
    console.error('❌ [updateBranch] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'ไม่พบสาขาที่ต้องการอัปเดต' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ error: 'ชื่อสาขาหรือชื่อย่อ URL (slug) ซ้ำกับระบบอื่น' });
    }
    return res.status(500).json({ error: 'ไม่สามารถอัปเดตสาขาได้' });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const id = toInt(req.params?.id);
    if (!id) return res.status(400).json({ error: 'id ไม่ถูกต้อง' });

    await prisma.branch.delete({ where: { id } });
    return res.json({ message: 'ลบสาขาสำเร็จ' });
  } catch (error) {
    console.error('❌ [deleteBranch] error:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'ไม่พบสาขาที่ต้องการลบ' });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(409).json({ error: 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)' });
    }
    return res.status(500).json({ error: 'ไม่สามารถลบสาขาได้' });
  }
};

module.exports = Object.freeze({
  getAllBranches,
  getBranchById,
  getBranchBySlug,
  createBranch,
  updateBranch,
  deleteBranch,
  normalizeBranchBody,
  buildPartialUpdate,
  hydrateBranchAddress,
});
