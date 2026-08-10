function getDefaultPrismaClient() {
  return require('../../../../database/prisma/client');
}

class GetRepairPartStockOptionsRepository {
  constructor(client = null) {
    this.client = client;
  }

  get prisma() {
    return this.client || getDefaultPrismaClient();
  }

  findRepairJob(branchId, repairJobId) {
    return this.prisma.repairJob.findFirst({
      where: { id: Number(repairJobId), branchId: Number(branchId) },
      select: { id: true, branchId: true, jobNo: true },
    });
  }

  findProduct(productId) {
    return this.prisma.product.findUnique({
      where: { id: Number(productId) },
      select: {
        id: true,
        name: true,
        active: true,
        branchId: true,
        trackSerialNumber: true,
        inventoryBehavior: true,
      },
    });
  }

  findAvailableStockItems(branchId, productId, query) {
    const q = String(query || '').trim();
    return this.prisma.stockItem.findMany({
      where: {
        branchId: Number(branchId),
        productId: Number(productId),
        status: 'IN_STOCK',
        ...(q ? {
          OR: [
            { barcode: { contains: q, mode: 'insensitive' } },
            { serialNumber: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
      take: 30,
      select: {
        id: true,
        barcode: true,
        serialNumber: true,
        status: true,
        receivedAt: true,
        locationCode: true,
        costPrice: true,
      },
    });
  }
}

module.exports = new GetRepairPartStockOptionsRepository();
module.exports.GetRepairPartStockOptionsRepository = GetRepairPartStockOptionsRepository;
