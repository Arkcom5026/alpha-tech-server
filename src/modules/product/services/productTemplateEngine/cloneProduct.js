const cloneProduct = async (tx, { templateProduct, targetProductTypeId }) => {
  const created = await tx.product.create({
    data: {
      name: templateProduct.name,
      mode: templateProduct.mode,
      noSN: templateProduct.noSN,
      active: true,
      trackSerialNumber: templateProduct.trackSerialNumber,
      productTypeId: Number(targetProductTypeId),
      brandId: templateProduct.brandId,
      codeType: templateProduct.codeType,
      productConfig: templateProduct.productConfig,
      unitId: templateProduct.unitId,
      warrantyDays: templateProduct.warrantyDays,
      templateProductId: templateProduct.id,
    },
    select: { id: true },
  })

  return created.id
}

module.exports = { cloneProduct }