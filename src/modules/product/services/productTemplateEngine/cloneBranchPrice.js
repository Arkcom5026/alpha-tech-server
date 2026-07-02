const cloneBranchPrice = async (tx, { templateProduct, newProductId, targetBranchId, updatedBy = null }) => {
    const source = templateProduct.branchPrice?.[0]
  
    await tx.branchPrice.create({
      data: {
        productId: Number(newProductId),
        branchId: Number(targetBranchId),
        effectiveDate: source?.effectiveDate ?? null,
        expiredDate: source?.expiredDate ?? null,
        note: `Cloned from template product ${templateProduct.id}`,
        updatedBy,
        isActive: source?.isActive ?? true,
        costPrice: source?.costPrice ?? 0,
        priceOnline: source?.priceOnline ?? null,
        priceRetail: source?.priceRetail ?? null,
        priceTechnician: source?.priceTechnician ?? null,
        priceWholesale: source?.priceWholesale ?? null,
      },
    })
  }
  
  module.exports = { cloneBranchPrice }