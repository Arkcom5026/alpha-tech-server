const prisma = require('../../../database/prisma/client');
const { createStockMovement } = require('../../inventory/movement/stockMovementWriter');

const repairJobDetailInclude = {
  branch: true,
  customer: { include: { user: true } },
  stockItem: {
    include: {
      product: { include: { brand: true, productType: true } },
      purchaseOrderReceiptItem: {
        include: { receipt: { include: { supplier: true } } },
      },
      saleItems: {
        include: { sale: { include: { customer: { include: { user: true } } } } },
        orderBy: { sale: { soldAt: 'desc' } },
      },
    },
  },
  technician: true,
  partsUsed: { include: { product: true } },
  warrantyClaims: {
    include: {
      supplier: true,
      events: {
        include: { performedBy: true },
        orderBy: { occurredAt: 'asc' },
      },
    },
    orderBy: { openedAt: 'desc' },
  },
};

class AddRepairPartRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) => work(new AddRepairPartRepository(tx)));
  }

  findRepairJob(branchId, repairJobId) {
    return this.prisma.repairJob.findFirst({
      where: { id: Number(repairJobId), branchId: Number(branchId) },
      include: repairJobDetailInclude,
    });
  }

  findLatestWorkflowEvent(branchId, repairJobId, deviceId) {
    return this.prisma.devicePassportEvent.findFirst({
      where: {
        deviceId: Number(deviceId),
        branchId: Number(branchId),
        sourceType: 'REPAIR_JOB',
        sourceId: String(repairJobId),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
  }

  findProduct(productId) {
    return this.prisma.product.findUnique({ where: { id: Number(productId) } });
  }

  findStockBalance(branchId, productId) {
    return this.prisma.stockBalance.findUnique({
      where: {
        productId_branchId: {
          productId: Number(productId),
          branchId: Number(branchId),
        },
      },
    });
  }

  findBranchPrice(branchId, productId) {
    return this.prisma.branchPrice.findUnique({
      where: {
        productId_branchId: {
          productId: Number(productId),
          branchId: Number(branchId),
        },
      },
    });
  }

  createRepairPart(data) {
    return this.prisma.repairPartItem.create({
      data,
      include: { product: true },
    });
  }

  decrementStockBalance(branchId, productId, qtyUsed) {
    return this.prisma.stockBalance.update({
      where: {
        productId_branchId: {
          productId: Number(productId),
          branchId: Number(branchId),
        },
      },
      data: { quantity: { decrement: qtyUsed } },
    });
  }

  createStockMovement(data) {
    return createStockMovement(this.prisma, data);
  }
}

module.exports = new AddRepairPartRepository();
module.exports.AddRepairPartRepository = AddRepairPartRepository;
