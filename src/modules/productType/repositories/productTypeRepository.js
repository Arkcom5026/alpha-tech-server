// src/modules/productType/repositories/productTypeRepository.js
// ProductType Module Repository v2
//
// Module Isolation Rule:
// ProductType module owns ProductType behavior only.
// Do not import Brand/Category/other module logic here.
//
// Current Domain Rule:
// - ProductType ownership is branchId only.
// - ProductType does not own categoryId.
 // - Category truth flows through ProductType -> GlobalProductType -> Category.
 // - globalProductTypeId is the runtime taxonomy anchor for ProductType.

const DEFAULT_TEMPLATE_BRANCH_CODE = 'T01';
const DEFAULT_TEMPLATE_BRANCH_ID = 1;

const toPositiveInt = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const normalizeText = (value) => String(value || '').trim();

class ProductTypeRepository {
  constructor(prisma) {
    if (!prisma) throw new Error('[ProductTypeRepository] prisma is required');
    this.prisma = prisma;
  }

  async findBranchById(branchId) {
    const id = toPositiveInt(branchId);
    if (!id) return null;

    return this.prisma.branch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        branchCode: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findTemplateBranch({
    templateBranchCode = DEFAULT_TEMPLATE_BRANCH_CODE,
    templateBranchId = DEFAULT_TEMPLATE_BRANCH_ID,
  } = {}) {
    const code = normalizeText(templateBranchCode) || DEFAULT_TEMPLATE_BRANCH_CODE;
    const fallbackId = toPositiveInt(templateBranchId) || DEFAULT_TEMPLATE_BRANCH_ID;

    return this.prisma.branch.findFirst({
      where: {
        OR: [{ branchCode: code }, { id: fallbackId }],
      },
      select: {
        id: true,
        name: true,
        branchCode: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async listBranchProductTypes({
    branchId,
    search = '',
    includeInactive = false,
    skip = 0,
    take = 20,
  } = {}) {
    const bId = toPositiveInt(branchId);
    const q = normalizeText(search);
    if (!bId) return { items: [], total: 0 };

    const where = {
      branchId: bId,
      ...(includeInactive ? {} : { active: true }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { normalizedName: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.productType.findMany({
        where,
        orderBy: [{ active: 'desc' }, { name: 'asc' }, { id: 'asc' }],
        skip,
        take,
        include: {
          globalProductType: {
            select: {
              id: true,
              name: true,
              slug: true,
              categoryId: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              Product: true,
              productTypeBrands: true,
            },
          },
          productTypeBrands: {
            select: {
              brandId: true,
              brand: {
                select: {
                  id: true,
                  name: true,
                  active: true,
                },
              },
            },
            orderBy: [{ brand: { name: 'asc' } }, { brandId: 'asc' }],
          },
        },
      }),
      this.prisma.productType.count({ where }),
    ]);

    return { items, total };
  }

  async listBranchProductTypeDropdowns({ branchId, includeInactive = false } = {}) {
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
        globalProductType: {
          select: {
            id: true,
            name: true,
            slug: true,
            categoryId: true,
          },
        },
      },
    });
  }

  async findBranchProductTypeById({ id, branchId, includeInactive = true } = {}) {
    const ptId = toPositiveInt(id);
    const bId = toPositiveInt(branchId);
    if (!ptId || !bId) return null;

    return this.prisma.productType.findFirst({
      where: {
        id: ptId,
        branchId: bId,
        ...(includeInactive ? {} : { active: true }),
      },
      include: {
          globalProductType: {
            select: {
              id: true,
              name: true,
              slug: true,
              categoryId: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        _count: {
          select: {
            Product: true,
            productTypeBrands: true,
          },
        },
        productTypeBrands: {
          select: {
            brandId: true,
            brand: {
              select: {
                id: true,
                name: true,
                active: true,
              },
            },
          },
          orderBy: [{ brand: { name: 'asc' } }, { brandId: 'asc' }],
        },
      },
    });
  }

  async findAnyProductTypeById(id) {
    const productTypeId = toPositiveInt(id);
    if (!productTypeId) return null;

    return this.prisma.productType.findUnique({
      where: { id: productTypeId },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        branchId: true,
        globalProductTypeId: true,
        globalProductType: {
          select: {
            id: true,
            name: true,
            slug: true,
            categoryId: true,
          },
        },
      },
    });
  }

  async listTemplateProductTypes({
    templateBranchId,
    includeInactive = false,
  } = {}) {
    const branchId = toPositiveInt(templateBranchId);
    if (!branchId) return [];

    return this.prisma.productType.findMany({
      where: {
        branchId,
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
        globalProductType: {
          select: {
            id: true,
            name: true,
            slug: true,
            categoryId: true,
          },
        },
        _count: {
          select: {
            productTypeBrands: true,
            Product: true,
          },
        },
      },
    });
  }

  async findBranchProductTypeDuplicate({ branchId, globalProductTypeId, normalizedName, excludeId } = {}) {
    const bId = toPositiveInt(branchId);
    const gId = toPositiveInt(globalProductTypeId);
    const nName = normalizeText(normalizedName);
    const exId = toPositiveInt(excludeId);
    if (!bId || !gId || !nName) return null;

    return this.prisma.productType.findFirst({
      where: {
        branchId: bId,
        normalizedName: nName,
        ...(exId ? { id: { not: exId } } : {}),
      },
      select: {
        id: true,
        name: true,
        branchId: true,
        globalProductTypeId: true,
        normalizedName: true,
      },
    });
  }


  async listGlobalProductTypeOptions({
    categoryId = null,
    includeInactive = false,
    search = '',
  } = {}) {
    const cId = toPositiveInt(categoryId);
    const q = normalizeText(search);

    return this.prisma.globalProductType.findMany({
      where: {
        ...(cId ? { categoryId: cId } : {}),
        ...(includeInactive ? {} : { active: true }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async createProductTypeWithBrandClone({ productTypeData, sourceProductTypeId = null }) {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.productType.create({
        data: productTypeData,
        select: { id: true },
      });

      let clonedBrandCount = 0;
      const sourceId = toPositiveInt(sourceProductTypeId);

      if (sourceId) {
        const sourceBrandLinks = await tx.productTypeBrand.findMany({
          where: {
            productTypeId: sourceId,
            brand: { active: true },
          },
          select: { brandId: true },
        });

        const brandRows = sourceBrandLinks
          .map((row) => toPositiveInt(row?.brandId))
          .filter(Boolean)
          .map((brandId) => ({
            productTypeId: created.id,
            brandId,
          }));

        if (brandRows.length > 0) {
          const result = await tx.productTypeBrand.createMany({
            data: brandRows,
            skipDuplicates: true,
          });
          clonedBrandCount = result?.count || 0;
        }
      }

      const full = await tx.productType.findUnique({
        where: { id: created.id },
        include: {
          globalProductType: {
            select: {
              id: true,
              name: true,
              slug: true,
              categoryId: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              Product: true,
              productTypeBrands: true,
            },
          },
          productTypeBrands: {
            select: {
              brandId: true,
              brand: {
                select: {
                  id: true,
                  name: true,
                  active: true,
                },
              },
            },
            orderBy: [{ brand: { name: 'asc' } }, { brandId: 'asc' }],
          },
        },
      });

      return {
        productType: full,
        clonedBrandCount,
      };
    });
  }

  async updateBranchProductType({ id, branchId, data } = {}) {
    const ptId = toPositiveInt(id);
    const bId = toPositiveInt(branchId);
    if (!ptId || !bId) return null;

    await this.prisma.productType.updateMany({
      where: {
        id: ptId,
        branchId: bId,
      },
      data,
    });

    return this.findBranchProductTypeById({
      id: ptId,
      branchId: bId,
      includeInactive: true,
    });
  }
}

module.exports = {
  DEFAULT_TEMPLATE_BRANCH_CODE,
  DEFAULT_TEMPLATE_BRANCH_ID,
  ProductTypeRepository,
};
