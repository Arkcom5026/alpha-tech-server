// src/modules/productTemplate/repositories/productTemplateRepository.js
// Mission C — Template Catalog Repository
// Data access for canonical Product Template records stored as Product rows under Template Branch T01.

const DEFAULT_TEMPLATE_BRANCH_CODE = 'T01';

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const normalizeText = (value) => String(value || '').trim();

const isTrueLike = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
};

const templateProductSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  active: true,
  mode: true,
  noSN: true,
  trackSerialNumber: true,
  productTypeId: true,
  brandId: true,
  codeType: true,
  productConfig: true,
  unitId: true,
  warrantyDays: true,
  templateProductId: true,
  productType: {
    select: {
      id: true,
      name: true,
      branchId: true,
      active: true,
      globalProductTypeId: true,
      globalProductType: {
        select: {
          id: true,
          name: true,
          categoryId: true,
          category: { select: { id: true, name: true, active: true } },
        },
      },
    },
  },
  brand: { select: { id: true, name: true, active: true } },
  unit: { select: { id: true, name: true } },
  productImages: {
    where: { active: true },
    orderBy: [{ isCover: 'desc' }, { id: 'asc' }],
    take: 5,
    select: { id: true, url: true, secure_url: true, isCover: true, public_id: true },
  },
  branchPrice: {
    take: 1,
    select: {
      id: true,
      branchId: true,
      costPrice: true,
      priceRetail: true,
      priceOnline: true,
      priceTechnician: true,
      priceWholesale: true,
      isActive: true,
    },
  },
};

class ProductTemplateRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('[ProductTemplateRepository] prisma is required');
    this.prisma = prisma;
  }

  async findTemplateBranchByCode(branchCode = DEFAULT_TEMPLATE_BRANCH_CODE) {
    return this.prisma.branch.findFirst({
      where: { branchCode: normalizeText(branchCode) || DEFAULT_TEMPLATE_BRANCH_CODE },
      select: { id: true, name: true, branchCode: true, slug: true, features: true },
    });
  }

  buildWhere({ templateBranchId, search = '', includeInactive = false, productTypeId, brandId, categoryId, mode } = {}) {
    const q = normalizeText(search);
    const whereAND = [
      {
        productType: {
          branchId: Number(templateBranchId),
        },
      },
    ];

    if (!isTrueLike(includeInactive)) whereAND.push({ active: true });

    if (q) {
      whereAND.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { brand: { name: { contains: q, mode: 'insensitive' } } },
          { productType: { name: { contains: q, mode: 'insensitive' } } },
          { unit: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const ptId = toPositiveInt(productTypeId);
    if (ptId) whereAND.push({ productTypeId: ptId });

    const brId = toPositiveInt(brandId);
    if (brId) whereAND.push({ brandId: brId });

    const catId = toPositiveInt(categoryId);
    if (catId) {
      whereAND.push({ productType: { globalProductType: { categoryId: catId } } });
    }

    const normalizedMode = normalizeText(mode).toUpperCase();
    if (normalizedMode === 'SIMPLE' || normalizedMode === 'STRUCTURED') {
      whereAND.push({ mode: normalizedMode });
    }

    return { AND: whereAND };
  }

  async list({ templateBranchId, search, includeInactive, productTypeId, brandId, categoryId, mode, skip, take } = {}) {
    const where = this.buildWhere({ templateBranchId, search, includeInactive, productTypeId, brandId, categoryId, mode });

    const [items, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: templateProductSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, totalItems };
  }

  async findById({ id, templateBranchId }) {
    return this.prisma.product.findFirst({
      where: {
        id: Number(id),
        productType: { branchId: Number(templateBranchId) },
      },
      select: templateProductSelect,
    });
  }

  async createTemplate({ templateBranchId, payload }) {
    const productTypeId = toPositiveInt(payload.productTypeId);
    if (!productTypeId) {
      const err = new Error('productTypeId is required');
      err.statusCode = 400;
      err.code = 'PRODUCT_TYPE_REQUIRED';
      throw err;
    }

    const productType = await this.prisma.productType.findFirst({
      where: { id: productTypeId, branchId: Number(templateBranchId) },
      select: { id: true },
    });

    if (!productType) {
      const err = new Error('productTypeId must belong to template branch');
      err.statusCode = 400;
      err.code = 'PRODUCT_TYPE_NOT_TEMPLATE_BRANCH';
      throw err;
    }

    return this.prisma.product.create({
      data: {
        name: normalizeText(payload.name),
        active: payload.active !== undefined ? Boolean(payload.active) : true,
        mode: normalizeText(payload.mode).toUpperCase() === 'SIMPLE' ? 'SIMPLE' : 'STRUCTURED',
        noSN: Boolean(payload.noSN),
        trackSerialNumber: Boolean(payload.trackSerialNumber),
        productTypeId,
        brandId: toPositiveInt(payload.brandId),
        codeType: payload.codeType ? normalizeText(payload.codeType) : undefined,
        productConfig: payload.productConfig || undefined,
        unitId: toPositiveInt(payload.unitId),
        warrantyDays: toPositiveInt(payload.warrantyDays),
      },
      select: templateProductSelect,
    });
  }

  async updateTemplate({ id, templateBranchId, payload }) {
    const current = await this.findById({ id, templateBranchId });
    if (!current) return null;

    const data = {};
    if (payload.name !== undefined) data.name = normalizeText(payload.name);
    if (payload.active !== undefined) data.active = Boolean(payload.active);
    if (payload.mode !== undefined) data.mode = normalizeText(payload.mode).toUpperCase() === 'SIMPLE' ? 'SIMPLE' : 'STRUCTURED';
    if (payload.noSN !== undefined) data.noSN = Boolean(payload.noSN);
    if (payload.trackSerialNumber !== undefined) data.trackSerialNumber = Boolean(payload.trackSerialNumber);
    if (payload.productTypeId !== undefined) data.productTypeId = toPositiveInt(payload.productTypeId);
    if (payload.brandId !== undefined) data.brandId = toPositiveInt(payload.brandId);
    if (payload.codeType !== undefined) data.codeType = payload.codeType ? normalizeText(payload.codeType) : null;
    if (payload.productConfig !== undefined) data.productConfig = payload.productConfig;
    if (payload.unitId !== undefined) data.unitId = toPositiveInt(payload.unitId);
    if (payload.warrantyDays !== undefined) data.warrantyDays = toPositiveInt(payload.warrantyDays);

    return this.prisma.product.update({
      where: { id: Number(id) },
      data,
      select: templateProductSelect,
    });
  }

  async setActive({ id, templateBranchId, active }) {
    const current = await this.findById({ id, templateBranchId });
    if (!current) return null;
    return this.prisma.product.update({
      where: { id: Number(id) },
      data: { active: Boolean(active) },
      select: templateProductSelect,
    });
  }
}

module.exports = {
  DEFAULT_TEMPLATE_BRANCH_CODE,
  ProductTemplateRepository,
};
