const repository = require('./productTemplateRuntimeRepository');

const toPositiveInt = (value, fallback = null) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

const toNonNegativeDecimal = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const toNonNegativeInt = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
};

const normalizeText = (value) => String(value || '').trim();

const toBoolean = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const hasPriceSnapshotPayload = (payload = {}) =>
  ['costPrice', 'priceRetail', 'priceOnline', 'priceTechnician', 'priceWholesale'].some(
    (key) => payload[key] !== undefined,
  );

const getPagination = (query = {}) => {
  const page = toPositiveInt(query.page, 1);
  const limitRaw = toPositiveInt(query.limit ?? query.take ?? query.takeNum, 20);
  const limit = Math.max(1, Math.min(limitRaw, 100));
  return { page, limit, skip: Math.max(0, (page - 1) * limit), take: limit };
};

const mapTemplate = (product, templateBranch = null) => {
  if (!product) return null;
  const category = product.productType?.globalProductType?.category || null;
  const cover = (product.productImages || []).find((image) => image.isCover)
    || product.productImages?.[0]
    || null;
  const branchPrice = product.branchPrice?.[0] || null;

  return {
    id: product.id,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    name: product.name,
    title: product.name,
    active: product.active,
    status: product.active ? 'ACTIVE' : 'INACTIVE',
    mode: product.mode,
    noSN: product.noSN,
    trackSerialNumber: product.trackSerialNumber,
    categoryId: category?.id ?? product.productType?.globalProductType?.categoryId ?? null,
    categoryName: category?.name ?? null,
    category,
    productTypeId: product.productTypeId,
    productTypeName: product.productType?.name ?? null,
    productType: product.productType,
    brandId: product.brandId,
    brandName: product.brand?.name ?? null,
    brand: product.brand,
    unitId: product.unitId,
    unitName: product.unit?.name ?? null,
    unit: product.unit,
    codeType: product.codeType,
    warrantyDays: product.warrantyDays,
    productConfig: product.productConfig,
    imageUrl: cover?.secure_url || cover?.url || null,
    images: product.productImages || [],
    costPrice: branchPrice?.costPrice != null ? Number(branchPrice.costPrice) : null,
    priceRetail: branchPrice?.priceRetail != null ? Number(branchPrice.priceRetail) : null,
    priceOnline: branchPrice?.priceOnline != null ? Number(branchPrice.priceOnline) : null,
    priceTechnician: branchPrice?.priceTechnician != null ? Number(branchPrice.priceTechnician) : null,
    priceWholesale: branchPrice?.priceWholesale != null ? Number(branchPrice.priceWholesale) : null,
    isTemplateProduct: true,
    templateProductId: product.id,
    templateBranchId: templateBranch?.id ?? product.productType?.branchId ?? null,
    templateBranchCode: templateBranch?.branchCode ?? repository.DEFAULT_TEMPLATE_BRANCH_CODE,
  };
};

const resolveTemplateBranch = async (query = {}) => {
  const branchCode = normalizeText(query.templateBranchCode || query.catalog || query.branchCode)
    || repository.DEFAULT_TEMPLATE_BRANCH_CODE;
  const branch = await repository.findTemplateBranchByCode(branchCode);
  if (!branch) {
    const error = new Error(`Template branch not found: ${branchCode}`);
    error.statusCode = 404;
    error.code = 'TEMPLATE_BRANCH_NOT_FOUND';
    throw error;
  }
  return branch;
};

const syncTemplatePriceSnapshot = async (productId, templateBranchId, payload = {}) => {
  if (!hasPriceSnapshotPayload(payload)) return null;

  const existing = await repository.findPriceSnapshot({
    productId,
    branchId: templateBranchId,
  });
  const fallbackCostPrice = existing?.costPrice != null ? Number(existing.costPrice) : 0;
  const update = { isActive: true, note: 'Template price snapshot' };

  if (payload.costPrice !== undefined) {
    update.costPrice = toNonNegativeDecimal(payload.costPrice) ?? fallbackCostPrice;
  }
  if (payload.priceRetail !== undefined) update.priceRetail = toNonNegativeInt(payload.priceRetail);
  if (payload.priceOnline !== undefined) update.priceOnline = toNonNegativeInt(payload.priceOnline);
  if (payload.priceTechnician !== undefined) update.priceTechnician = toNonNegativeInt(payload.priceTechnician);
  if (payload.priceWholesale !== undefined) update.priceWholesale = toNonNegativeInt(payload.priceWholesale);

  return repository.upsertPriceSnapshot({
    productId,
    branchId: templateBranchId,
    create: {
      productId: Number(productId),
      branchId: Number(templateBranchId),
      costPrice: update.costPrice ?? fallbackCostPrice,
      priceRetail: update.priceRetail ?? null,
      priceOnline: update.priceOnline ?? null,
      priceTechnician: update.priceTechnician ?? null,
      priceWholesale: update.priceWholesale ?? null,
      isActive: true,
      note: 'Template price snapshot',
    },
    update,
  });
};

const listTemplates = async (query = {}) => {
  const templateBranch = await resolveTemplateBranch(query);
  const { page, limit, skip, take } = getPagination(query);
  const { items, totalItems } = await repository.list({
    templateBranchId: templateBranch.id,
    search: query.q || query.search || query.searchText,
    includeInactive: toBoolean(query.includeInactive),
    productTypeId: query.productTypeId,
    brandId: query.brandId,
    categoryId: query.categoryId,
    mode: query.mode,
    skip,
    take,
  });
  return {
    items: items.map((item) => mapTemplate(item, templateBranch)),
    page,
    limit,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    templateBranch,
  };
};

const getTemplateById = async (id, query = {}) => {
  const templateBranch = await resolveTemplateBranch(query);
  const template = await repository.findById({ id, templateBranchId: templateBranch.id });
  if (!template) {
    const error = new Error('Product Template not found');
    error.statusCode = 404;
    error.code = 'PRODUCT_TEMPLATE_NOT_FOUND';
    throw error;
  }
  return mapTemplate(template, templateBranch);
};

const createTemplate = async (payload = {}, query = {}) => {
  const templateBranch = await resolveTemplateBranch(query);
  const template = await repository.createTemplate({ templateBranchId: templateBranch.id, payload });
  await syncTemplatePriceSnapshot(template.id, templateBranch.id, payload);
  const refreshed = await repository.findById({ id: template.id, templateBranchId: templateBranch.id });
  return mapTemplate(refreshed || template, templateBranch);
};

const updateTemplate = async (id, payload = {}, query = {}) => {
  const templateBranch = await resolveTemplateBranch(query);
  const template = await repository.updateTemplate({ id, templateBranchId: templateBranch.id, payload });
  if (!template) {
    const error = new Error('Product Template not found');
    error.statusCode = 404;
    error.code = 'PRODUCT_TEMPLATE_NOT_FOUND';
    throw error;
  }
  await syncTemplatePriceSnapshot(id, templateBranch.id, payload);
  const refreshed = await repository.findById({ id, templateBranchId: templateBranch.id });
  return mapTemplate(refreshed || template, templateBranch);
};

const setActive = async (id, active, query = {}) => {
  const templateBranch = await resolveTemplateBranch(query);
  const template = await repository.setActive({
    id,
    templateBranchId: templateBranch.id,
    active,
  });
  if (!template) {
    const error = new Error('Product Template not found');
    error.statusCode = 404;
    error.code = 'PRODUCT_TEMPLATE_NOT_FOUND';
    throw error;
  }
  return mapTemplate(template, templateBranch);
};

module.exports = {
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  setActive,
};
