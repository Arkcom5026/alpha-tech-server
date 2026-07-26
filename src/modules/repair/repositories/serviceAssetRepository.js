class ServiceAssetRepository {
  constructor(client) {
    if (!client?.serviceAsset) {
      throw new TypeError('ServiceAssetRepository requires a Prisma client');
    }
    this.prisma = client;
  }

  findServiceAsset(branchId, serviceAssetId) {
    return this.prisma.serviceAsset.findFirst({
      where: {
        id: Number(serviceAssetId),
        branchId: Number(branchId),
      },
      include: {
        images: {
          where: { active: true },
          orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
        },
        product: true,
        productType: true,
        brand: true,
        sourceStockItem: true,
      },
    });
  }

  findServiceAssetBySourceStockItem(sourceStockItemId) {
    return this.prisma.serviceAsset.findUnique({
      where: { sourceStockItemId: Number(sourceStockItemId) },
      include: {
        images: {
          where: { active: true },
          orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
        },
        product: true,
        productType: true,
        brand: true,
        sourceStockItem: true,
      },
    });
  }

  createServiceAsset(data) {
    return this.prisma.serviceAsset.create({
      data,
      include: {
        images: true,
        product: true,
        productType: true,
        brand: true,
        sourceStockItem: true,
      },
    });
  }

  updateServiceAsset(serviceAssetId, data) {
    return this.prisma.serviceAsset.update({
      where: { id: Number(serviceAssetId) },
      data,
      include: {
        images: {
          where: { active: true },
          orderBy: [{ isCover: 'desc' }, { createdAt: 'asc' }],
        },
        product: true,
        productType: true,
        brand: true,
        sourceStockItem: true,
      },
    });
  }
}

module.exports = ServiceAssetRepository;
