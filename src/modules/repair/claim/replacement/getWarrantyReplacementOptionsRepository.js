class GetWarrantyReplacementOptionsRepository {
  constructor(client = null) {
    this.client = client;
  }

  get prisma() {
    if (!this.client) {
      this.client = require('../../../../database/prisma/client');
    }
    return this.client;
  }

  findClaim(branchId, claimId) {
    return this.prisma.warrantyClaim.findFirst({
      where: { id: Number(claimId), branchId: Number(branchId) },
      select: {
        id: true,
        branchId: true,
        status: true,
        stockItemId: true,
        stockItem: { select: { productId: true } },
      },
    });
  }

  searchAvailableStock(branchId, query, preferredProductId = null) {
    const term = String(query || '').trim();
    return this.prisma.stockItem.findMany({
      where: {
        branchId: Number(branchId),
        status: 'IN_STOCK',
        ...(term
          ? {
              OR: [
                { barcode: { contains: term, mode: 'insensitive' } },
                { serialNumber: { contains: term, mode: 'insensitive' } },
                { product: { name: { contains: term, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        barcode: true,
        serialNumber: true,
        status: true,
        productId: true,
        product: {
          select: { id: true, name: true, brand: { select: { name: true } } },
        },
      },
      orderBy: [
        ...(preferredProductId ? [{ productId: 'asc' }] : []),
        { id: 'desc' },
      ],
      take: 30,
    });
  }
}

module.exports = new GetWarrantyReplacementOptionsRepository();
module.exports.GetWarrantyReplacementOptionsRepository = GetWarrantyReplacementOptionsRepository;
