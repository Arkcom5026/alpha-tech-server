const { TEMPLATE_BRANCH_CODE } = require('./constants')

const validateTemplate = async (tx, { templateProductId, templateBranchCode = TEMPLATE_BRANCH_CODE }) => {
  const templateBranch = await tx.branch.findFirst({
    where: { branchCode: templateBranchCode },
    select: { id: true, name: true, branchCode: true, features: true },
  })

  if (!templateBranch) {
    throw Object.assign(new Error('TEMPLATE_BRANCH_NOT_FOUND'), {
      status: 404,
      code: 'TEMPLATE_BRANCH_NOT_FOUND',
    })
  }

  const templateProduct = await tx.product.findFirst({
    where: {
      id: Number(templateProductId),
      active: true,
      branchPrice: {
        some: { branchId: templateBranch.id },
      },
    },
    include: {
      productImages: {
        where: { active: true },
        orderBy: [{ isCover: 'desc' }, { id: 'asc' }],
      },
      branchPrice: {
        where: { branchId: templateBranch.id },
        take: 1,
      },
    },
  })

  if (!templateProduct) {
    throw Object.assign(new Error('TEMPLATE_PRODUCT_NOT_FOUND'), {
      status: 404,
      code: 'TEMPLATE_PRODUCT_NOT_FOUND',
    })
  }

  if (!templateProduct.productTypeId) {
    throw Object.assign(new Error('TEMPLATE_PRODUCT_TYPE_REQUIRED'), {
      status: 400,
      code: 'TEMPLATE_PRODUCT_TYPE_REQUIRED',
    })
  }

  return { templateBranch, templateProduct }
}

module.exports = { validateTemplate }