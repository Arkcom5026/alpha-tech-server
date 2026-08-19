const { Prisma } = require('@prisma/client');
const featurePresets = require('../../../../constants/branchFeaturePresets');
const repository = require('./branchRuntimeRepository');
const {
  collectPaymentAccountIds,
  normalizeDocumentPresentationConfig,
} = require('../../document-presentation/presentationConfig');
const {
  assertStorePaymentAccountsOwnedByBranch,
} = require('../../finance/store-payment-account/storePaymentAccountService');

const DOCUMENT_HEADER_ALIGNMENTS = new Set(['left', 'center', 'right']);
const DOCUMENT_HEADER_NAME_SIZES = new Set(['sm', 'md', 'lg', 'xl']);
const DOCUMENT_HEADER_LOGO_SIZE_MIN = 24;
const DOCUMENT_HEADER_LOGO_SIZE_MAX = 180;
const DOCUMENT_HEADER_LOGO_SIZE_DEFAULT = 56;
const LEGACY_DOCUMENT_HEADER_LOGO_SIZES = Object.freeze({ sm: 40, md: 56, lg: 72, xl: 88 });
const DOCUMENT_HEADER_KEYS = new Set([
  'showLogo',
  'logoUrl',
  'logoPosition',
  'logoSize',
  'textAlign',
  'showStoreName',
  'storeName',
  'storeNameSize',
  'showAddress',
  'address',
  'showPhone',
  'phone',
  'showTaxId',
  'taxId',
  'showBranchLabel',
  'headerNote',
]);

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getStr = (value) => (value === null || value === undefined ? '' : String(value).trim());
const compact = (object) => Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

const normalizeLogoSize = (value) => {
  const legacy = LEGACY_DOCUMENT_HEADER_LOGO_SIZES[getStr(value).toLowerCase()];
  const parsed = legacy ?? Number(value);
  if (!Number.isFinite(parsed)) return DOCUMENT_HEADER_LOGO_SIZE_DEFAULT;
  return Math.min(DOCUMENT_HEADER_LOGO_SIZE_MAX, Math.max(DOCUMENT_HEADER_LOGO_SIZE_MIN, Math.round(parsed)));
};

const normalizeHeaderProfile = (source) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};

  const output = {};
  for (const key of DOCUMENT_HEADER_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = source[key];

    if (key.startsWith('show')) {
      if (typeof value === 'boolean') output[key] = value;
      continue;
    }

    if (key === 'logoPosition' || key === 'textAlign') {
      const normalized = getStr(value).toLowerCase();
      if (DOCUMENT_HEADER_ALIGNMENTS.has(normalized)) output[key] = normalized;
      continue;
    }

    if (key === 'logoSize') {
      output[key] = normalizeLogoSize(value);
      continue;
    }

    if (key === 'storeNameSize') {
      const normalized = getStr(value).toLowerCase();
      if (DOCUMENT_HEADER_NAME_SIZES.has(normalized)) output[key] = normalized;
      continue;
    }

    const maxLength = key === 'logoUrl' ? 2048 : key === 'headerNote' ? 500 : 300;
    output[key] = getStr(value).slice(0, maxLength);
  }

  return output;
};

const normalizeDocumentHeaderConfig = (value) => {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  if (Number(value.version) === 2) {
    return normalizeDocumentPresentationConfig(value);
  }

  const documents = {};
  const rawDocuments = value.documents;
  if (rawDocuments && typeof rawDocuments === 'object' && !Array.isArray(rawDocuments)) {
    for (const [rawKey, profile] of Object.entries(rawDocuments)) {
      const key = getStr(rawKey).toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 64);
      if (!key) continue;
      documents[key] = normalizeHeaderProfile(profile);
    }
  }

  return {
    version: 1,
    default: normalizeHeaderProfile(value.default),
    documents,
  };
};

const normalizeBody = (body = {}) => ({
  name: getStr(body.name),
  address: getStr(body.address),
  phone: getStr(body.phone),
  slug: getStr(body.slug).toLowerCase().replace(/\s+/g, '') || undefined,
  subdistrictCode:
    getStr(body.subdistrictCode) ||
    getStr(body.subdistrict_id) ||
    getStr(body.subdistrictId) ||
    getStr(body.subdistrict),
  businessType: getStr(body.businessType).toUpperCase() || undefined,
  features: body.features && typeof body.features === 'object' ? body.features : undefined,
  documentHeaderConfig: normalizeDocumentHeaderConfig(body.documentHeaderConfig),
  RBACEnabled: typeof body.RBACEnabled === 'boolean' ? body.RBACEnabled : undefined,
  testMode: body.testMode === true,
});

const hydrateAddress = (branch) => {
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
  output.fullAddress = [
    output.subdistrictName ? `ตำบล${output.subdistrictName}` : null,
    output.districtName ? `อำเภอ${output.districtName}` : null,
    output.provinceName ? `จังหวัด${output.provinceName}` : null,
    output.postalCode || null,
  ].filter(Boolean).join(' ').trim();
  return output;
};

const makeError = (statusCode, code, message) => Object.assign(new Error(message), { statusCode, code });

const listBranches = async () => (await repository.list()).map(hydrateAddress);

const getBranchById = async (rawId) => {
  const id = toInt(rawId);
  if (!id) throw makeError(400, 'INVALID_BRANCH_ID', 'id ไม่ถูกต้อง');
  const branch = await repository.findById(id);
  if (!branch) throw makeError(404, 'BRANCH_NOT_FOUND', 'ไม่พบสาขา');
  return hydrateAddress(branch);
};

const getBranchBySlug = async (rawSlug) => {
  const slug = getStr(rawSlug).toLowerCase();
  if (!slug) throw makeError(400, 'BRANCH_SLUG_REQUIRED', 'กรุณาระบุชื่อย่อร้านค้า (slug)');
  const branch = await repository.findBySlug(slug);
  if (!branch) throw makeError(404, 'BRANCH_NOT_FOUND', 'ไม่พบร้านค้าพาร์ตเนอร์ที่ระบุในระบบ');
  return hydrateAddress(branch);
};

const createBranch = async (body = {}) => {
  const BASE_BRANCH_ID = 2;
  const TEST_BRANCH_SLUG_PREFIX = 'system-test-';
  const normalized = normalizeBody(body);
  const isTestBranch = normalized.testMode === true;

  if (!normalized.name) throw makeError(400, 'BRANCH_NAME_REQUIRED', 'กรุณากรอกชื่อสาขา');
  if (!normalized.address) throw makeError(400, 'BRANCH_ADDRESS_REQUIRED', 'กรุณากรอกที่อยู่สาขา');
  if (isTestBranch && !normalized.slug?.startsWith(TEST_BRANCH_SLUG_PREFIX)) {
    throw makeError(400, 'INVALID_TEST_BRANCH_SLUG', 'ร้านทดสอบต้องใช้ slug ที่ขึ้นต้นด้วย system-test-');
  }
  if (Object.prototype.hasOwnProperty.call(body, 'documentHeaderConfig') && normalized.documentHeaderConfig === undefined) {
    throw makeError(400, 'INVALID_DOCUMENT_HEADER_CONFIG', 'รูปแบบเอกสารไม่ถูกต้อง');
  }
  if (normalized.documentHeaderConfig?.version === 2 && collectPaymentAccountIds(normalized.documentHeaderConfig).length) {
    throw makeError(
      400,
      'STORE_PAYMENT_ACCOUNT_SELECTION_REQUIRES_EXISTING_BRANCH',
      'ต้องสร้างร้านก่อนจึงจะเลือกบัญชีรับชำระสำหรับเอกสารได้',
    );
  }

  if (normalized.businessType && !normalized.features && featurePresets[normalized.businessType]) {
    normalized.features = featurePresets[normalized.businessType];
  }

  try {
    const created = await repository.create(compact({
      name: normalized.name,
      address: normalized.address,
      phone: normalized.phone || null,
      slug: normalized.slug || null,
      RBACEnabled: normalized.RBACEnabled,
      businessType: normalized.businessType,
      features: normalized.features,
      documentHeaderConfig: normalized.documentHeaderConfig,
      subdistrict: normalized.subdistrictCode ? { connect: { code: normalized.subdistrictCode } } : undefined,
    }));

    if (isTestBranch) return { ...created, clonedPrices: 0, testMode: true };

    try {
      const basePrices = await repository.listBasePrices(BASE_BRANCH_ID);
      if (basePrices.length) {
        await repository.createPrices(basePrices.map((item) => ({
          productId: item.productId,
          branchId: created.id,
          isActive: true,
          costPrice: item.costPrice,
          priceRetail: item.priceRetail,
          priceOnline: item.priceOnline,
          priceTechnician: item.priceTechnician,
          priceWholesale: item.priceWholesale,
        })));
      }
      return created;
    } catch (_cloneError) {
      return { ...created, clonedPrices: 0, cloneWarning: 'Clone ราคาสำเร็จบางส่วน หรือไม่สมบูรณ์' };
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw makeError(409, 'BRANCH_DUPLICATE', 'ชื่อสาขาหรือชื่อย่อ URL (slug) ซ้ำกับระบบอื่น');
    }
    throw error;
  }
};

const updateBranch = async (rawId, body = {}) => {
  const id = toInt(rawId);
  if (!id) throw makeError(400, 'INVALID_BRANCH_ID', 'id ไม่ถูกต้อง');

  const normalized = normalizeBody(body);
  const has = (key, ...aliases) => [key, ...aliases].some((name) => Object.prototype.hasOwnProperty.call(body, name));
  const data = {};
  if (has('name')) data.name = normalized.name;
  if (has('address')) data.address = normalized.address;
  if (has('phone')) data.phone = normalized.phone || null;
  if (has('slug')) data.slug = normalized.slug || null;
  if (has('RBACEnabled')) data.RBACEnabled = normalized.RBACEnabled;
  if (has('businessType')) data.businessType = normalized.businessType;
  if (has('features')) data.features = normalized.features !== undefined ? normalized.features : Prisma.JsonNull;
  if (has('documentHeaderConfig')) {
    if (normalized.documentHeaderConfig === undefined) {
      throw makeError(400, 'INVALID_DOCUMENT_HEADER_CONFIG', 'รูปแบบเอกสารไม่ถูกต้อง');
    }
    if (normalized.documentHeaderConfig?.version === 2) {
      await assertStorePaymentAccountsOwnedByBranch(
        id,
        collectPaymentAccountIds(normalized.documentHeaderConfig),
      );
    }
    data.documentHeaderConfig = normalized.documentHeaderConfig === null
      ? Prisma.JsonNull
      : normalized.documentHeaderConfig;
  }
  if (has('subdistrictCode', 'subdistrict_id', 'subdistrictId', 'subdistrict')) {
    data.subdistrict = normalized.subdistrictCode
      ? { connect: { code: normalized.subdistrictCode } }
      : { disconnect: true };
  }
  if (has('businessType') && !has('features') && featurePresets[normalized.businessType]) {
    data.features = featurePresets[normalized.businessType];
  }
  if (!Object.keys(data).length) throw makeError(400, 'BRANCH_UPDATE_EMPTY', 'ไม่มีข้อมูลสำหรับอัปเดต');

  try {
    return hydrateAddress(await repository.update(id, data));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw makeError(404, 'BRANCH_NOT_FOUND', 'ไม่พบสาขาที่ต้องการอัปเดต');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw makeError(409, 'BRANCH_DUPLICATE', 'ชื่อสาขาหรือชื่อย่อ URL (slug) ซ้ำกับระบบอื่น');
    }
    throw error;
  }
};

const deleteBranch = async (rawId) => {
  const id = toInt(rawId);
  if (!id) throw makeError(400, 'INVALID_BRANCH_ID', 'id ไม่ถูกต้อง');
  try {
    await repository.remove(id);
    return { message: 'ลบสาขาสำเร็จ' };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw makeError(404, 'BRANCH_NOT_FOUND', 'ไม่พบสาขาที่ต้องการลบ');
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      throw makeError(409, 'BRANCH_HAS_REFERENCES', 'ลบไม่ได้ มีการอ้างอิงอยู่ (foreign key constraint)');
    }
    throw error;
  }
};

module.exports = {
  listBranches,
  getBranchById,
  getBranchBySlug,
  createBranch,
  updateBranch,
  deleteBranch,
};
