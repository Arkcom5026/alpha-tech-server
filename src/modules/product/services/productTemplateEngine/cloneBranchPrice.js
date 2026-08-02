const priceAuthorityPolicy = require('../../pricing/policies/priceAuthorityPolicy')

const cloneBranchPrice = async (tx, {
  templateProduct,
  newProductId,
  targetBranchId,
  updatedBy = null,
  role,
  v2Role,
}) => {
  const source = templateProduct.branchPrice?.[0]
  if (!source) {
    const error = new Error('ไม่พบราคาต้นแบบสำหรับสินค้านี้')
    error.code = 'TEMPLATE_BRANCH_PRICE_REQUIRED'
    error.status = 409
    error.statusCode = 409
    throw error
  }

  const payload = {
    costPrice: source.costPrice,
    priceRetail: source.priceRetail,
    priceWholesale: source.priceWholesale,
    priceTechnician: source.priceTechnician,
    priceOnline: source.priceOnline,
  }

  const authority = priceAuthorityPolicy.assertPricePayload({
    actor: {
      branchId: targetBranchId,
      employeeId: updatedBy,
      role,
      v2Role,
    },
    payload,
    effectiveDate: source.effectiveDate,
    expiredDate: source.expiredDate,
  })

  await tx.branchPrice.create({
    data: {
      productId: Number(newProductId),
      branchId: authority.branchId,
      effectiveDate: source.effectiveDate ?? null,
      expiredDate: source.expiredDate ?? null,
      note: `Cloned from template product ${templateProduct.id}`,
      updatedBy: authority.employeeId,
      isActive: source.isActive ?? true,
      costPrice: source.costPrice,
      priceOnline: source.priceOnline ?? null,
      priceRetail: source.priceRetail ?? null,
      priceTechnician: source.priceTechnician ?? null,
      priceWholesale: source.priceWholesale ?? null,
    },
  })
}

module.exports = { cloneBranchPrice }
