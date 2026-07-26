const prisma = require('../../../database/prisma/client');

class RepairPartUsageRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) => work(new RepairPartUsageRepository(tx)));
  }

  findRepairJob(branchId, repairJobId) {
    return this.prisma.repairJob.findFirst({
      where: {
        id: Number(repairJobId),
        branchId: Number(branchId),
      },
    });
  }

  findPartUsage(repairJobId, partItemId) {
    return this.prisma.repairPartItem.findFirst({
      where: {
        id: Number(partItemId),
        repairJobId: Number(repairJobId),
      },
      include: { product: true },
    });
  }

  restoreStock(branchId, productId, quantity) {
    return this.prisma.stockBalance.update({
      where: {
        productId_branchId: {
          productId: Number(productId),
          branchId: Number(branchId),
        },
      },
      data: {
        quantity: { increment: Number(quantity) },
      },
    });
  }

  deletePartUsage(partItemId) {
    return this.prisma.repairPartItem.delete({
      where: { id: Number(partItemId) },
    });
  }

  createStockMovement(data) {
    return this.prisma.stockMovement.create({ data });
  }
}

module.exports = new RepairPartUsageRepository();
module.exports.RepairPartUsageRepository = RepairPartUsageRepository;
