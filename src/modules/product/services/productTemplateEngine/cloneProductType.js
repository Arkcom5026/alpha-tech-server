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
      normalizedName: source.normalizedName,
      pathCached: source.pathCached || null,
      guideExamples: Array.isArray(source.guideExamples) ? source.guideExamples : [],
      active: source.active,
      branchId: Number(targetBranchId),
      globalProductTypeId: source.globalProductTypeId,
    },
    select: { id: true },
  })

  return created.id
}

module.exports = { cloneProductType }
