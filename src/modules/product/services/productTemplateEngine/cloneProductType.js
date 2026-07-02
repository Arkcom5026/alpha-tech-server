const cloneProductType = async (tx, { templateProductTypeId, targetBranchId }) => {
    const source = await tx.productType.findUnique({
      where: { id: Number(templateProductTypeId) },
    })
  
    if (!source) {
      throw Object.assign(new Error('TEMPLATE_PRODUCT_TYPE_NOT_FOUND'), {
        status: 404,
        code: 'TEMPLATE_PRODUCT_TYPE_NOT_FOUND',
      })
    }
  
    const existing = await tx.productType.findFirst({
      where: {
        branchId: Number(targetBranchId),
        globalProductTypeId: source.globalProductTypeId,
        normalizedName: source.normalizedName,
      },
      select: { id: true },
    })
  
    if (existing) return existing.id
  
    const created = await tx.productType.create({
      data: {
        name: source.name,
        slug: source.slug ? `${source.slug}-${targetBranchId}` : null,
        normalizedName: source.normalizedName,
        description: source.description,
        active: source.active,
        branchId: Number(targetBranchId),
        categoryId: source.categoryId,
        globalProductTypeId: source.globalProductTypeId,
      },
      select: { id: true },
    })
  
    return created.id
  }
  
  module.exports = { cloneProductType }