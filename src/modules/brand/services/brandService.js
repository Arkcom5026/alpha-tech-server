// src/modules/brand/services/brandService.js
// Brand Module Service
// Self-contained module rule:
// Brand owns its page-specific ProductType options through Brand service/repository,
// without importing ProductType module logic.
//
// Current domain rule:
// ProductType ownership is branchId only.
// categoryId is business category context and must not be used as ProductType/Brand guard.
// globalProductTypeId is future platform search reference and is not used as a filter now.

const { Prisma } = require('../../../../lib/prisma');
const { BrandRepository } = require('../repositories/brandRepository');

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const normalizeName = (name) => String(name || '').trim();

const normalizeKey = (name) =>
  normalizeName(name)
    .replace(/\s+/g, ' ')
    .toLowerCase();

const parseBool = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  return String(value).toLowerCase() === 'true';
};

class BrandService {
  constructor(prisma, repository = null) {
    if (!prisma && !repository) throw new Error('[BrandService] prisma or repository is required');
    this.prisma = prisma;
    this.repository = repository || new BrandRepository(prisma);
  }

  getBranchIdFromUser(user) {
    return toPositiveInt(user?.branchId || user?.branch?.id);
  }

  requireBranchId(user) {
    const branchId = this.getBranchIdFromUser(user);
    if (!branchId) {
      const err = new Error('ไม่พบข้อมูลสาขาใน token กรุณาเข้าสู่ระบบใหม่');
      err.statusCode = 403;
      err.code = 'BRANCH_REQUIRED';
      throw err;
    }
    return branchId;
  }

  async requireBranchContext(user) {
    const branchId = this.requireBranchId(user);
    const branch = await this.repository.findBranchContext(branchId);

    if (!branch?.id) {
      const err = new Error('ไม่พบข้อมูลสาขา');
      err.statusCode = 404;
      err.code = 'BRANCH_NOT_FOUND';
      throw err;
    }

    return branch;
  }

  mapProductTypeOption(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      active: row.active,
      isActive: row.active,
      branchId: row.branchId,
      categoryId: row.categoryId,
      globalProductTypeId: row.globalProductTypeId,
      brandCount: Number(row?._count?.productTypeBrands || 0),
      productCount: Number(row?._count?.Product || 0),
    };
  }

  async listProductTypeOptions({ query = {}, user = {} } = {}) {
    const branchId = this.requireBranchId(user);

    const rows = await this.repository.listProductTypeOptionsForBrand({
      branchId,
      includeInactive: parseBool(query.includeInactive, false),
    });

    return {
      branch: {
        id: branchId,
      },
      items: rows.map((row) => this.mapProductTypeOption(row)).filter(Boolean),
      total: rows.length,
    };
  }

  buildBrandWhere({ q, includeInactive, productTypeId }) {
    const whereBase = {
      ...(includeInactive ? {} : { active: true }),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };

    if (!productTypeId) return whereBase;

    return {
      ...whereBase,
      productTypeBrands: {
        some: { productTypeId },
      },
    };
  }

  mapBrand(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      normalizedName: row.normalizedName,
      active: row.active,
      isActive: row.active,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      productTypeBrandCount: Number(row?._count?.productTypeBrands || 0),
      productCount: Number(row?._count?.products || 0),
    };
  }

  async listBrands({ query = {}, user = {} } = {}) {
    const q = String(query.q || query.search || '').trim();
    const includeInactive = parseBool(query.includeInactive, false);
    const productTypeId = toPositiveInt(query.productTypeId);

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const pageSizeRaw = query.pageSize || query.limit || '20';
    const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeRaw, 10)));
    const skip = (page - 1) * pageSize;

    if (productTypeId) {
      const branchId = this.requireBranchId(user);
      const productType = await this.repository.findProductTypeForBranch({
        productTypeId,
        branchId,
      });

      if (!productType?.id) {
        const err = new Error('ไม่พบประเภทสินค้าของสาขานี้');
        err.statusCode = 404;
        err.code = 'PRODUCT_TYPE_NOT_FOUND';
        throw err;
      }
    }

    const where = this.buildBrandWhere({
      q,
      includeInactive,
      productTypeId,
    });

    const { items, total } = await this.repository.listBrands({
      where,
      skip,
      take: pageSize,
    });

    return {
      items: items.map((item) => this.mapBrand(item)),
      page,
      pageSize,
      total,
    };
  }

  async listDropdownBrands({ query = {}, user = {} } = {}) {
    const q = String(query.q || query.search || '').trim();
    const includeInactive = parseBool(query.includeInactive, false);
    const productTypeId = toPositiveInt(query.productTypeId);

    let where = {
      ...(includeInactive ? {} : { active: true }),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    };

    if (productTypeId) {
      const branchId = this.requireBranchId(user);
      const productType = await this.repository.findProductTypeForBranch({
        productTypeId,
        branchId,
      });

      if (!productType?.id) {
        const err = new Error('ไม่พบประเภทสินค้าของสาขานี้');
        err.statusCode = 404;
        err.code = 'PRODUCT_TYPE_NOT_FOUND';
        throw err;
      }

      const mapCount = await this.repository.countBrandLinksForProductType(productTypeId);

      if (mapCount > 0) {
        where = {
          ...where,
          productTypeBrands: {
            some: { productTypeId },
          },
        };
      }
    }

    return this.repository.listDropdownBrands({ where });
  }

  async createBrand({ payload = {} } = {}) {
    const name = normalizeName(payload?.name);
    if (!name) {
      const err = new Error('กรุณาระบุชื่อแบรนด์');
      err.statusCode = 400;
      err.code = 'NAME_REQUIRED';
      throw err;
    }

    const normalizedName = normalizeKey(name);

    try {
      const existing = await this.repository.findBrandByNormalizedName(normalizedName);
      if (existing?.id) {
        const err = new Error('ชื่อแบรนด์ซ้ำ');
        err.statusCode = 409;
        err.code = 'DUPLICATE_BRAND';
        err.conflict = existing;
        throw err;
      }

      return this.repository.createBrand({ name, normalizedName });
    } catch (err) {
      if (err?.code === 'DUPLICATE_BRAND') throw err;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const e = new Error('ชื่อแบรนด์ซ้ำ');
        e.statusCode = 409;
        e.code = 'DUPLICATE_BRAND';
        throw e;
      }
      throw err;
    }
  }

  async updateBrand({ id, payload = {} } = {}) {
    const brandId = toPositiveInt(id);
    if (!brandId) {
      const err = new Error('id ไม่ถูกต้อง');
      err.statusCode = 400;
      err.code = 'INVALID_ID';
      throw err;
    }

    const name = normalizeName(payload?.name);
    if (!name) {
      const err = new Error('กรุณาระบุชื่อแบรนด์');
      err.statusCode = 400;
      err.code = 'NAME_REQUIRED';
      throw err;
    }

    const normalizedName = normalizeKey(name);

    try {
      return await this.repository.updateBrand({
        id: brandId,
        data: { name, normalizedName },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        const e = new Error('ไม่พบแบรนด์ที่ต้องการแก้ไข');
        e.statusCode = 404;
        e.code = 'BRAND_NOT_FOUND';
        throw e;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const e = new Error('ชื่อแบรนด์ซ้ำ');
        e.statusCode = 409;
        e.code = 'DUPLICATE_BRAND';
        throw e;
      }
      throw err;
    }
  }

  async toggleBrand({ id, payload = {} } = {}) {
    const brandId = toPositiveInt(id);
    if (!brandId) {
      const err = new Error('id ไม่ถูกต้อง');
      err.statusCode = 400;
      err.code = 'INVALID_ID';
      throw err;
    }

    const activeRaw = payload?.active !== undefined ? payload.active : payload?.isActive;
    if (activeRaw === undefined) {
      const err = new Error('กรุณาระบุสถานะ active');
      err.statusCode = 400;
      err.code = 'ACTIVE_REQUIRED';
      throw err;
    }

    try {
      return await this.repository.updateBrand({
        id: brandId,
        data: { active: !!activeRaw },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        const e = new Error('ไม่พบแบรนด์ที่ต้องการเปลี่ยนสถานะ');
        e.statusCode = 404;
        e.code = 'BRAND_NOT_FOUND';
        throw e;
      }
      throw err;
    }
  }

  async listProductTypeBrandLinks({ query = {}, user = {} } = {}) {
    const productTypeId = toPositiveInt(query.productTypeId);
    if (!productTypeId) {
      const err = new Error('กรุณาระบุ productTypeId');
      err.statusCode = 400;
      err.code = 'PRODUCT_TYPE_ID_REQUIRED';
      throw err;
    }

    const branchId = this.requireBranchId(user);
    const productType = await this.repository.findProductTypeForBranch({
      productTypeId,
      branchId,
    });

    if (!productType?.id) {
      const err = new Error('ไม่พบประเภทสินค้าของสาขานี้');
      err.statusCode = 404;
      err.code = 'PRODUCT_TYPE_NOT_FOUND';
      throw err;
    }

    const links = await this.repository.listProductTypeBrandLinks({
      productTypeId,
      includeInactive: parseBool(query.includeInactive, false),
    });

    return {
      productType,
      items: links,
      total: links.length,
    };
  }

  async attachBrandToProductType({ payload = {}, user = {} } = {}) {
    const productTypeId = toPositiveInt(payload?.productTypeId);
    const brandId = toPositiveInt(payload?.brandId);

    if (!productTypeId || !brandId) {
      const err = new Error('กรุณาระบุ productTypeId และ brandId ให้ถูกต้อง');
      err.statusCode = 400;
      err.code = 'INVALID_PRODUCTTYPE_OR_BRAND';
      throw err;
    }

    const branchId = this.requireBranchId(user);
    const productType = await this.repository.findProductTypeForBranch({
      productTypeId,
      branchId,
    });

    if (!productType?.id) {
      const err = new Error('ไม่พบประเภทสินค้าของสาขานี้');
      err.statusCode = 404;
      err.code = 'PRODUCT_TYPE_NOT_FOUND';
      throw err;
    }

    try {
      return await this.repository.attachBrandToProductType({ productTypeId, brandId });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        const e = new Error('ไม่สามารถผูกแบรนด์ได้ เนื่องจากมีการอ้างอิงไม่ถูกต้อง');
        e.statusCode = 409;
        e.code = 'PRODUCT_TYPE_BRAND_FOREIGN_KEY_CONSTRAINT';
        throw e;
      }
      throw err;
    }
  }

  async detachBrandFromProductType({ id, user = {} } = {}) {
    const linkId = toPositiveInt(id);
    if (!linkId) {
      const err = new Error('id ไม่ถูกต้อง');
      err.statusCode = 400;
      err.code = 'INVALID_ID';
      throw err;
    }

    const branchId = this.requireBranchId(user);
    const link = await this.repository.findBrandLinkForBranch({
      id: linkId,
      branchId,
    });

    if (!link?.id) {
      const err = new Error('ไม่พบ mapping แบรนด์ของประเภทสินค้าสาขานี้');
      err.statusCode = 404;
      err.code = 'PRODUCT_TYPE_BRAND_LINK_NOT_FOUND';
      throw err;
    }

    return this.repository.detachBrandLink({ id: linkId });
  }
}

module.exports = {
  BrandService,
};
