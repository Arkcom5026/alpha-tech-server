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

  async findActiveSubcontract(repairJobId) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT "id", "status", "providerName"
       FROM "RepairSubcontract"
       WHERE "repairJobId" = $1 AND "status" IN ('SENT','RETURN_REQUESTED')
       ORDER BY "sentAt" DESC, "id" DESC
       LIMIT 1
       FOR UPDATE`,
      Number(repairJobId)
    );
    return rows[0] || null;
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

  findStockItem(branchId, productId, stockItemId) {
    return this.prisma.stockItem.findFirst({
      where: {
        id: Number(stockItemId),
        branchId: Number(branchId),
        productId: Number(productId),
      },
      select: {
        id: true,
        branchId: true,
        productId: true,
        barcode: true,
        serialNumber: true,
        status: true,
      },
    });
  }

  consumeStockItem(branchId, productId, stockItemId) {
    return this.prisma.stockItem.updateMany({
      where: {
        id: Number(stockItemId),
        branchId: Number(branchId),
        productId: Number(productId),
        status: 'IN_STOCK',
      },
      data: { status: 'USED' },
    });
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
    return this.prisma.stockBalance.updateMany({
      where: {
        productId: Number(productId),
        branchId: Number(branchId),
        quantity: { gte: qtyUsed },
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
