// src/modules/brand/repositories/brandRepository.js
// Brand Module Repository
// Self-contained module rule:
// Brand module may query DB tables it needs, but must not import ProductType service/store/module logic.
//
// Current domain rule:
// ProductType ownership is branchId only.
// Do not use categoryId or globalProductTypeId as filters/guards in Brand module.

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const normalizeText = (value) => String(value || '').trim();

class BrandRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('[BrandRepository] prisma is required');
    this.prisma = prisma;
  }

  async findBranchContext(branchId) {
    const bId = toPositiveInt(branchId);
    if (!bId) return null;

    return this.prisma.branch.findUnique({
      where: { id: bId },
      select: {
        id: true,
        name: true,
        category: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
      },
    });
  }

  async listProductTypeOptionsForBrand({ branchId, includeInactive = false } = {}) {
    const bId = toPositiveInt(branchId);
    if (!bId) return [];

    return this.prisma.productType.findMany({
      where: {
        branchId: bId,
        ...(includeInactive ? {} : { active: true }),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        branchId: true,
        globalProductTypeId: true,
        _count: {
          select: {
            productTypeBrands: true,
            Product: true,
          },
        },
      },
    });
  }

  async listBrands({ where, skip, take } = {}) {
    const [items, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        orderBy: [{ active: 'desc' }, { name: 'asc' }, { id: 'asc' }],
        skip,
        take,
        select: {
          id: true,
          name: true,
          normalizedName: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              productTypeBrands: true,
              products: true,
            },
          },
        },
      }),
      this.prisma.brand.count({ where }),
    ]);

    return { items, total };
  }

  async listDropdownBrands({ where } = {}) {
    return this.prisma.brand.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        active: true,
      },
    });
  }

  async countBrandLinksForProductType(productTypeId) {
    const id = toPositiveInt(productTypeId);
    if (!id) return 0;

    return this.prisma.productTypeBrand.count({
      where: { productTypeId: id },
    });
  }

  async findBrandByNormalizedName(normalizedName) {
    const key = normalizeText(normalizedName);
    if (!key) return null;

    return this.prisma.brand.findFirst({
      where: { normalizedName: key },
      select: { id: true, name: true, normalizedName: true, active: true },
    });
  }

  async createBrand({ name, normalizedName }) {
    return this.prisma.brand.create({
      data: {
        name,
        normalizedName,
        active: true,
      },
      select: {
        id: true,
        name: true,
        normalizedName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateBrand({ id, data }) {
    return this.prisma.brand.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        normalizedName: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findProductTypeForBranch({ productTypeId, branchId } = {}) {
    const ptId = toPositiveInt(productTypeId);
    const bId = toPositiveInt(branchId);
    if (!ptId) return null;

    return this.prisma.productType.findFirst({
      where: {
        id: ptId,
        ...(bId ? { branchId: bId } : {}),
      },
      select: {
        id: true,
        name: true,
        branchId: true,
        globalProductTypeId: true,
        globalProductType: { select: { id:true,name:true,categoryId:true } },
        active: true,
      },
    });
  }

  async listProductTypeBrandLinks({ productTypeId, includeInactive = false }) {
    const ptId = toPositiveInt(productTypeId);
    if (!ptId) return [];

    return this.prisma.productTypeBrand.findMany({
      where: {
        productTypeId: ptId,
        ...(includeInactive ? {} : { brand: { active: true } }),
      },
      orderBy: [{ brand: { name: 'asc' } }, { brandId: 'asc' }],
      select: {
        id: true,
        productTypeId: true,
        brandId: true,
        brand: {
          select: {
            id: true,
            name: true,
            active: true,
            normalizedName: true,
          },
        },
      },
    });
  }

  async attachBrandToProductType({ productTypeId, brandId }) {
    return this.prisma.productTypeBrand.upsert({
      where: {
        productTypeId_brandId: {
          productTypeId,
          brandId,
        },
      },
      update: {},
      create: {
        productTypeId,
        brandId,
      },
      select: {
        id: true,
        productTypeId: true,
        brandId: true,
        brand: {
          select: {
            id: true,
            name: true,
            active: true,
            normalizedName: true,
          },
        },
      },
    });
  }

  async detachBrandLink({ id }) {
    return this.prisma.productTypeBrand.delete({
      where: { id },
      select: {
        id: true,
        productTypeId: true,
        brandId: true,
      },
    });
  }

  async findBrandLinkForBranch({ id, branchId }) {
    const linkId = toPositiveInt(id);
    const bId = toPositiveInt(branchId);
    if (!linkId) return null;

    return this.prisma.productTypeBrand.findFirst({
      where: {
        id: linkId,
        ...(bId
          ? {
              productType: {
                branchId: bId,
              },
            }
          : {}),
      },
      select: {
        id: true,
        productTypeId: true,
        brandId: true,
        productType: {
          select: {
            id: true,
            name: true,
            branchId: true,
                globalProductTypeId: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
      },
    });
  }
}

module.exports = {
  BrandRepository,
};
