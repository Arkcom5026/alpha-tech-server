// src/modules/productTemplate/services/productTemplateService.js
// Mission C — Template Catalog Service

const {
  DEFAULT_TEMPLATE_BRANCH_CODE,
  ProductTemplateRepository,
} = require('../repositories/productTemplateRepository');

const toPositiveInt = (value, fallback = null) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const normalizeText = (value) => String(value || '').trim();

const toBoolean = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
};

class ProductTemplateService {
  constructor(prisma, repository = null) {
    if (!prisma && !repository) {
      throw new Error('[ProductTemplateService] prisma or repository is required');
    }
    this.repository = repository || new ProductTemplateRepository(prisma);
  }

  getPagination(query = {}) {
    const page = toPositiveInt(query.page, 1);
    const limitRaw = toPositiveInt(query.limit ?? query.take ?? query.takeNum, 20);
    const limit = Math.max(1, Math.min(limitRaw, 100));
    const skip = Math.max(0, (page - 1) * limit);
    return { page, limit, skip, take: limit };
  }

  mapTemplate(product, templateBranch = null) {
    if (!product) return null;

    const category = product.category || product.productType?.globalProductType?.category || null;
    const cover = (product.productImages || []).find((image) => image.isCover) || product.productImages?.[0] || null;
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
      categoryId: category?.id ?? product.categoryId ?? null,
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
      templateBranchCode: templateBranch?.branchCode ?? DEFAULT_TEMPLATE_BRANCH_CODE,
    };
  }

  async resolveTemplateBranch(query = {}) {
    const branchCode = normalizeText(query.templateBranchCode || query.catalog || query.branchCode) || DEFAULT_TEMPLATE_BRANCH_CODE;
    const branch = await this.repository.findTemplateBranchByCode(branchCode);

    if (!branch) {
      const err = new Error(`Template branch not found: ${branchCode}`);
      err.statusCode = 404;
      err.code = 'TEMPLATE_BRANCH_NOT_FOUND';
      throw err;
    }

    return branch;
  }

  async listTemplates(query = {}) {
    const templateBranch = await this.resolveTemplateBranch(query);
    const { page, limit, skip, take } = this.getPagination(query);

    const { items, totalItems } = await this.repository.list({
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
      items: items.map((item) => this.mapTemplate(item, templateBranch)),
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      templateBranch,
    };
  }

  async getTemplateById(id, query = {}) {
    const templateBranch = await this.resolveTemplateBranch(query);
    const template = await this.repository.findById({ id, templateBranchId: templateBranch.id });

    if (!template) {
      const err = new Error('Product Template not found');
      err.statusCode = 404;
      err.code = 'PRODUCT_TEMPLATE_NOT_FOUND';
      throw err;
    }

    return this.mapTemplate(template, templateBranch);
  }

  async createTemplate(payload = {}, query = {}) {
    const templateBranch = await this.resolveTemplateBranch(query);
    const template = await this.repository.createTemplate({ templateBranchId: templateBranch.id, payload });
    return this.mapTemplate(template, templateBranch);
  }

  async updateTemplate(id, payload = {}, query = {}) {
    const templateBranch = await this.resolveTemplateBranch(query);
    const template = await this.repository.updateTemplate({ id, templateBranchId: templateBranch.id, payload });

    if (!template) {
      const err = new Error('Product Template not found');
      err.statusCode = 404;
      err.code = 'PRODUCT_TEMPLATE_NOT_FOUND';
      throw err;
    }

    return this.mapTemplate(template, templateBranch);
  }

  async setActive(id, active, query = {}) {
    const templateBranch = await this.resolveTemplateBranch(query);
    const template = await this.repository.setActive({ id, templateBranchId: templateBranch.id, active });

    if (!template) {
      const err = new Error('Product Template not found');
      err.statusCode = 404;
      err.code = 'PRODUCT_TEMPLATE_NOT_FOUND';
      throw err;
    }

    return this.mapTemplate(template, templateBranch);
  }
}

module.exports = {
  ProductTemplateService,
};
