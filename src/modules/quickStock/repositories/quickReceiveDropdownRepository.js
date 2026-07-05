// src/modules/quickStock/repositories/quickReceiveDropdownRepository.js
// Repository for Quick Receive / QuickStock dropdown workflow only.

const TEMPLATE_BRANCH_CODE = 'T01'

class QuickReceiveDropdownRepository {
  constructor(prisma) {
    if (!prisma) {
      throw new Error('[QuickReceiveDropdownRepository] prisma is required')
    }
    this.prisma = prisma
  }

  async findTemplateBranchByCode(branchCode = TEMPLATE_BRANCH_CODE) {
    return this.prisma.branch.findFirst({
      where: { branchCode },
      select: { id: true, branchCode: true },
    })
  }

  async findTemplateCatalogDropdownRows({ templateBranchId, productTypeId = null } = {}) {
    return this.prisma.product.findMany({
      where: {
        active: true,
        productType: {
          branchId: Number(templateBranchId),
        },
        ...(productTypeId ? { productTypeId: Number(productTypeId) } : {}),
      },
      select: {
        productType: {
          select: {
            id: true,
            name: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            active: true,
          },
        },
        unit: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ productType: { name: 'asc' } }, { brand: { name: 'asc' } }, { id: 'asc' }],
      take: 5000,
    })
  }
}

module.exports = {
  TEMPLATE_BRANCH_CODE,
  QuickReceiveDropdownRepository,
}
