// src/modules/productType/services/productTypeService.js
// ProductType Module Service v2
//
// Module Isolation Rule:
// ProductType service owns ProductType behavior only.
//
// Current Domain Rule:
// - ProductType ownership is branchId only.
// - ProductType does not own categoryId.
 // - Category truth flows through ProductType -> GlobalProductType -> Category.
 // - globalProductTypeId is the runtime taxonomy anchor for ProductType.

const {
  DEFAULT_TEMPLATE_BRANCH_CODE,
  DEFAULT_TEMPLATE_BRANCH_ID,
  ProductTypeRepository,
} = require('../repositories/productTypeRepository');

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const normalizeName = (raw) => {
  if (!raw) return '';
  let s = String(raw).normalize('NFC');
  s = s.replace(/[^A-Za-z0-9ก-๙ .]/g, '');
  s = s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
};

const slugify = (raw) => {
  const base = normalizeName(raw);
  return base.replace(/\./g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
};

const parseBool = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return String(value).toLowerCase() === 'true';
};

class ProductTypeService {
  constructor(prisma, repository = null) {
    if (!prisma && !repository) throw new Error('[ProductTypeService] prisma or repository is required');
    this.prisma = prisma;
    this.repository = repository || new ProductTypeRepository(prisma);
  }

  requireBranchId(branchId) {
    const currentBranchId = toPositiveInt(branchId);
    if (!currentBranchId) {
      const err = new Error('ไม่พบข้อมูลสาขาใน token กรุณาเข้าสู่ระบบใหม่');
      err.statusCode = 403;
      err.status = 403;
      err.code = 'BRANCH_REQUIRED';
      throw err;
    }
    return currentBranchId;
  }

  mapProductType(row, meta = {}) {
    if (!row) return null;

    const typeBrands = (Array.isArray(row?.productTypeBrands) ? row.productTypeBrands : [])
      .map((link) => {
        const brand = link?.brand;
        if (!brand?.id || !brand?.name || brand.active === false) return null;
        return {
          id: brand.id,
          name: brand.name,
          brandId: link?.brandId ?? brand.id,
        };
      })
      .filter(Boolean);

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      active: row.active,
      isActive: row.active,
      branchId: row.branchId,
      categoryId: row.globalProductType?.categoryId ?? null,
      globalProductTypeId: row.globalProductTypeId,
      globalProductType: row.globalProductType || null,
      productCount: Number(row?._count?.Product || 0),
      brandCount: Number(row?._count?.productTypeBrands || typeBrands.length || 0),
      clonedBrandCount: Number(meta?.clonedBrandCount || 0),
      brandOptions: typeBrands,
      brands: typeBrands,
      typeBrands,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  mapTemplateProductType(row) {
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      active: row.active,
      branchId: row.branchId,
      categoryId: row.globalProductType?.categoryId ?? null,
      globalProductTypeId: row.globalProductTypeId,
      globalProductType: row.globalProductType || null,
      brandCount: row?._count?.productTypeBrands || 0,
      productCount: row?._count?.Product || 0,
      isTemplateBranchProductType: true,
    };
  }


  mapGlobalProductTypeOption(row) {
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      active: row.active,
      categoryId: row.categoryId,
      category: row.category || null,
      isGlobalProductType: true,
    };
  }

  async listBranchProductTypes({ branchId, query = {} } = {}) {
    const currentBranchId = this.requireBranchId(branchId);

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limitRaw = query.limit || query.pageSize || '20';
    const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10)));
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.listBranchProductTypes({
      branchId: currentBranchId,
      search: query.search || query.q || '',
      includeInactive: parseBool(query.includeInactive, false),
      skip,
      take: limit,
    });

    return {
      items: items.map((row) => this.mapProductType(row)),
      page,
      limit,
      pageSize: limit,
      total,
    };
  }

  async listDropdowns({ branchId, query = {} } = {}) {
    const currentBranchId = this.requireBranchId(branchId);

    const rows = await this.repository.listBranchProductTypeDropdowns({
      branchId: currentBranchId,
      includeInactive: parseBool(query.includeInactive, false),
    });

    return rows.map((row) => this.mapProductType(row));
  }

  async getBranchProductTypeById({ branchId, id } = {}) {
    const currentBranchId = this.requireBranchId(branchId);
    const productTypeId = toPositiveInt(id);

    if (!productTypeId) {
      const err = new Error('id ไม่ถูกต้อง');
      err.statusCode = 400;
      err.code = 'INVALID_ID';
      throw err;
    }

    const row = await this.repository.findBranchProductTypeById({
      id: productTypeId,
      branchId: currentBranchId,
      includeInactive: true,
    });

    if (!row?.id) {
      const err = new Error('ไม่พบประเภทสินค้าของสาขานี้');
      err.statusCode = 404;
      err.code = 'PRODUCT_TYPE_NOT_FOUND';
      throw err;
    }

    return this.mapProductType(row);
  }


  async listGlobalOptions({ branchId, query = {} } = {}) {
    const currentBranchId = this.requireBranchId(branchId);

    const branch = await this.repository.findBranchById(currentBranchId);
    if (!branch?.id) {
      const err = new Error('ไม่พบข้อมูลสาขา');
      err.statusCode = 404;
      err.status = 404;
      err.code = 'BRANCH_NOT_FOUND';
      throw err;
    }

    const rows = await this.repository.listGlobalProductTypeOptions({
      categoryId: branch.categoryId,
      includeInactive: parseBool(query.includeInactive, false),
      search: query.search || query.q || '',
    });

    return {
      branch,
      items: rows.map((row) => this.mapGlobalProductTypeOption(row)).filter(Boolean),
    };
  }

  async listTemplateOptions({
    branchId,
    templateBranchCode = DEFAULT_TEMPLATE_BRANCH_CODE,
    templateBranchId = DEFAULT_TEMPLATE_BRANCH_ID,
    includeInactive = false,
  } = {}) {
    const currentBranchId = this.requireBranchId(branchId);

    const branch = await this.repository.findBranchById(currentBranchId);
    if (!branch?.id) {
      const err = new Error('ไม่พบข้อมูลสาขา');
      err.statusCode = 404;
      err.status = 404;
      err.code = 'BRANCH_NOT_FOUND';
      throw err;
    }

    const templateBranch = await this.repository.findTemplateBranch({
      templateBranchCode,
      templateBranchId,
    });

    if (!templateBranch?.id) {
      const err = new Error('ไม่พบสาขาต้นแบบสำหรับคัดลอกประเภทสินค้า');
      err.statusCode = 404;
      err.status = 404;
      err.code = 'TEMPLATE_BRANCH_NOT_FOUND';
      throw err;
    }

    const rows = await this.repository.listTemplateProductTypes({
      templateBranchId: templateBranch.id,
      includeInactive,
    });

    return {
      branch,
      templateBranch,
      items: rows.map((row) => this.mapTemplateProductType(row)),
    };
  }

  async resolveGlobalProductTypeId({ payload = {}, sourceProductType = null } = {}) {
    const fromSource = toPositiveInt(sourceProductType?.globalProductTypeId);
    if (fromSource) return fromSource;

    const fromPayload = toPositiveInt(payload?.globalProductTypeId);
    if (fromPayload) return fromPayload;

    const err = new Error('ไม่พบ GlobalProductType ของประเภทสินค้านี้');
    err.statusCode = 400;
    err.status = 400;
    err.code = 'GLOBAL_PRODUCT_TYPE_REQUIRED';
    throw err;
  }

  async createBranchProductType({ branchId, payload = {} } = {}) {
    const currentBranchId = this.requireBranchId(branchId);

    const branch = await this.repository.findBranchById(currentBranchId);
    if (!branch?.id) {
      const err = new Error('ไม่พบข้อมูลสาขา');
      err.statusCode = 404;
      err.status = 404;
      err.code = 'BRANCH_NOT_FOUND';
      throw err;
    }

    const nameTrim = String(payload?.name || '').trim();
    if (!nameTrim) {
      const err = new Error('กรุณาระบุชื่อประเภทสินค้า');
      err.statusCode = 400;
      err.status = 400;
      err.code = 'NAME_REQUIRED';
      throw err;
    }

    const sourceProductTypeId =
      toPositiveInt(payload?.sourceProductTypeId) ||
      toPositiveInt(payload?.templateProductTypeId);

    let sourceProductType = null;
    if (sourceProductTypeId) {
      sourceProductType = await this.repository.findAnyProductTypeById(sourceProductTypeId);
      if (!sourceProductType?.id) {
        const err = new Error('ไม่พบประเภทสินค้ากลางที่เลือก');
        err.statusCode = 404;
        err.status = 404;
        err.code = 'SOURCE_PRODUCT_TYPE_NOT_FOUND';
        throw err;
      }
    }

    const globalProductTypeId = await this.resolveGlobalProductTypeId({
      payload,
      sourceProductType,
    });

    const normalizedName = normalizeName(nameTrim);
    const duplicate = await this.repository.findBranchProductTypeDuplicate({
      branchId: currentBranchId,
      globalProductTypeId,
      normalizedName,
    });

    if (duplicate?.id) {
      const err = new Error('ร้านนี้มีประเภทสินค้านี้แล้ว');
      err.statusCode = 409;
      err.status = 409;
      err.code = 'DUPLICATE';
      err.conflict = duplicate;
      throw err;
    }

    const { productType, clonedBrandCount } = await this.repository.createProductTypeWithBrandClone({
      productTypeData: {
        name: nameTrim,
        normalizedName,
        slug: slugify(nameTrim),
        branchId: currentBranchId,
        globalProductTypeId,
        active: true,
        // categoryId intentionally omitted.
        // It is legacy/business-category residue and must not drive ProductType runtime.
      },
      sourceProductTypeId,
    });

    return this.mapProductType(productType, { clonedBrandCount });
  }

  async updateBranchProductType({ branchId, id, payload = {} } = {}) {
    const currentBranchId = this.requireBranchId(branchId);
    const productTypeId = toPositiveInt(id);

    if (!productTypeId) {
      const err = new Error('id ไม่ถูกต้อง');
      err.statusCode = 400;
      err.code = 'INVALID_ID';
      throw err;
    }

    const existing = await this.repository.findBranchProductTypeById({
      id: productTypeId,
      branchId: currentBranchId,
      includeInactive: true,
    });

    if (!existing?.id) {
      const err = new Error('ไม่พบประเภทสินค้าของสาขานี้');
      err.statusCode = 404;
      err.code = 'PRODUCT_TYPE_NOT_FOUND';
      throw err;
    }

    const nameTrim = String(payload?.name || existing.name || '').trim();
    if (!nameTrim) {
      const err = new Error('กรุณาระบุชื่อประเภทสินค้า');
      err.statusCode = 400;
      err.code = 'NAME_REQUIRED';
      throw err;
    }

    const normalizedName = normalizeName(nameTrim);
    const nextGlobalProductTypeId =
      toPositiveInt(payload?.globalProductTypeId) ||
      toPositiveInt(existing?.globalProductTypeId);

    const duplicate = await this.repository.findBranchProductTypeDuplicate({
      branchId: currentBranchId,
      globalProductTypeId: nextGlobalProductTypeId,
      normalizedName,
      excludeId: productTypeId,
    });

    if (duplicate?.id) {
      const err = new Error('ร้านนี้มีประเภทสินค้านี้แล้ว');
      err.statusCode = 409;
      err.code = 'DUPLICATE';
      err.conflict = duplicate;
      throw err;
    }

    const data = {
      name: nameTrim,
      normalizedName,
      slug: slugify(nameTrim),
    };

    if (nextGlobalProductTypeId) {
      data.globalProductTypeId = nextGlobalProductTypeId;
    }

    const row = await this.repository.updateBranchProductType({
      id: productTypeId,
      branchId: currentBranchId,
      data,
    });

    return this.mapProductType(row);
  }

  async setActive({ branchId, id, active } = {}) {
    const currentBranchId = this.requireBranchId(branchId);
    const productTypeId = toPositiveInt(id);

    if (!productTypeId) {
      const err = new Error('id ไม่ถูกต้อง');
      err.statusCode = 400;
      err.code = 'INVALID_ID';
      throw err;
    }

    const existing = await this.repository.findBranchProductTypeById({
      id: productTypeId,
      branchId: currentBranchId,
      includeInactive: true,
    });

    if (!existing?.id) {
      const err = new Error('ไม่พบประเภทสินค้าของสาขานี้');
      err.statusCode = 404;
      err.code = 'PRODUCT_TYPE_NOT_FOUND';
      throw err;
    }

    const row = await this.repository.updateBranchProductType({
      id: productTypeId,
      branchId: currentBranchId,
      data: { active: !!active },
    });

    return this.mapProductType(row);
  }
}

module.exports = {
  ProductTypeService,
};
