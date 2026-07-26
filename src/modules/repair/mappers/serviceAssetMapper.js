function mapServiceAsset(asset) {
  if (!asset) return null;

  return {
    id: asset.id,
    assetNo: asset.assetNo,
    branchId: asset.branchId,
    customerId: asset.customerId,
    sourceStockItemId: asset.sourceStockItemId,
    productId: asset.productId,
    productTypeId: asset.productTypeId,
    brandId: asset.brandId,
    source: asset.source,
    status: asset.status,
    deviceType: asset.deviceType,
    brandName: asset.brandNameSnapshot || asset.brand?.name || null,
    modelName: asset.modelName,
    serialNumber: asset.serialNumber,
    customerAssetTag: asset.customerAssetTag,
    color: asset.color,
    description: asset.description,
    accessories: asset.accessories || [],
    physicalCondition: asset.physicalCondition,
    accessInstructions: asset.accessInstructions,
    purchaseSource: asset.purchaseSource,
    purchaseDate: asset.purchaseDate,
    externalWarrantyUntil: asset.externalWarrantyUntil,
    externalWarrantyNote: asset.externalWarrantyNote,
    images: (asset.images || []).map((image) => ({
      id: image.id,
      url: image.url,
      secureUrl: image.secureUrl,
      caption: image.caption,
      kind: image.kind,
      isCover: image.isCover,
    })),
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
  };
}

module.exports = { mapServiceAsset };
