// src/modules/product/repositories/productTemplateRepository.js
// Product Template Repository
// Data access layer สำหรับ Product Template Runtime
// Repository รับผิดชอบ Prisma Query เท่านั้น
// Service รับผิดชอบ Business Flow

const DEFAULT_TEMPLATE_BRANCH_CODE = 'T01'

const toPositiveInt = (value) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : null
}

const normalizeText = (value) => String(value || '').trim()

const isTrueLike = (value) => {
  const v = String(value ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

class ProductTemplateRepository {
  constructor(prisma) {
    if (!prisma) {
      throw new Error('[ProductTemplateRepository] prisma is required')
    }
    this.prisma = prisma
  }

  async findTemplateBranchByCode(branchCode = DEFAULT_TEMPLATE_BRANCH_CODE) {
    return this.prisma.branch.findFirst({
      where: {
        branchCode: normalizeText(branchCode) || DEFAULT_TEMPLATE_BRANCH_CODE,
      },
      select: {
        id: true,
        name: true,
        branchCode: true,
        features: true,
      },
    })
  }

  buildTemplateProductWhere({
    templateBranchId,
    search = '',
    searchText = '',
    productTypeId,
    brandId,
    mode,
    includeInactive = false,
  } = {}) {
    const q = normalizeText(search || searchText)
    const typeId = toPositiveInt(productTypeId)
    const brId = toPositiveInt(brandId)

    const whereAND = [
      {
        branchPrice: {
          some: {
            branchId: Number(templateBranchId),
            isActive: true,
          },
        },
      },
    ]

    if (!isTrueLike(includeInactive)) {
      whereAND.push({ active: true })
    }

    if (q) {
      whereAND.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { brand: { name: { contains: q, mode: 'insensitive' } } },
          { productType: { name: { contains: q, mode: 'insensitive' } } },
        ],
      })
    }

    if (typeId) whereAND.push({ productTypeId: typeId })
    if (brId) whereAND.push({ brandId: brId })

    const normalizedMode = normalizeText(mode).toUpperCase()
    if (normalizedMode === 'SIMPLE' || normalizedMode === 'STRUCTURED') {
      whereAND.push({ mode: normalizedMode })
    }

    return { AND: whereAND }
  }

  async searchTemplateProducts({
    templateBranchId,
    search = '',
    searchText = '',
    productTypeId,
    brandId,
    mode,
    includeInactive = false,
    take = 100,
    skip = 0,
  } = {}) {
    const where = this.buildTemplateProductWhere({
      templateBranchId,
      search,
      searchText,
      productTypeId,
      brandId,
      mode,
      includeInactive,
    })

    return this.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        active: true,
        mode: true,
        noSN: true,
        trackSerialNumber: true,
        templateProductId: true,
        categoryId: true,
        productTypeId: true,
        productType: {
          select: {
            id: true,
            name: true,
            branchId: true,
            globalProductTypeId: true,
            globalProductType: {
              select: {
                categoryId: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        brandId: true,
        brand: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
        unitId: true,
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
        productImages: {
          where: {
            active: true,
            isCover: true,
          },
          take: 1,
          select: {
            id: true,
            url: true,
            secure_url: true,
            isCover: true,
          },
        },
        branchPrice: {
          where: {
            branchId: Number(templateBranchId),
            isActive: true,
          },
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
      },
      orderBy: [{ id: 'asc' }],
      take,
      skip,
    })
  }
}

module.exports = {
  DEFAULT_TEMPLATE_BRANCH_CODE,
  ProductTemplateRepository,
}
