function getDefaultPrismaClient() {
  return require('../../../../database/prisma/client');
}

const {
  publishDevicePassportEvent,
} = require('../../../device/passport/publish/devicePassportEventPublisher');

const warrantyClaimDetailInclude = {
  branch: true,
  stockItem: {
    include: {
      product: {
        include: {
          brand: true,
          productType: true,
        },
      },
    },
  },
  device: true,
  supplier: true,
  repairJob: {
    include: {
      customer: {
        include: {
          user: true,
        },
      },
    },
  },
  previousClaim: true,
  subsequentClaims: true,
  replacementStockItem: {
    include: {
      product: true,
    },
  },
  createdBy: true,
  resolvedBy: true,
  events: {
    include: {
      performedBy: true,
    },
    orderBy: {
      occurredAt: 'asc',
    },
  },
};

class UpdateWarrantyClaimStatusRepository {
  constructor(client = null) {
    this.client = client;
  }

  get prisma() {
    return this.client || getDefaultPrismaClient();
  }

  transaction(work) {
    return this.prisma.$transaction((tx) =>
      work(new UpdateWarrantyClaimStatusRepository(tx))
    );
  }

  findById(branchId, warrantyClaimId) {
    return this.prisma.warrantyClaim.findFirst({
      where: {
        id: Number(warrantyClaimId),
        branchId: Number(branchId),
      },
      include: warrantyClaimDetailInclude,
    });
  }

  findReplacementStockItem(replacementStockItemId) {
    return this.prisma.stockItem.findUnique({
      where: { id: Number(replacementStockItemId) },
    });
  }

  consumeReplacementStockItem({ branchId, stockItemId, claimId, employeeId }) {
    return this.prisma.stockItem.updateMany({
      where: {
        id: Number(stockItemId),
        branchId: Number(branchId),
        status: 'IN_STOCK',
      },
      data: {
        status: 'SOLD',
        soldAt: new Date(),
      },
    }).then(async (changed) => {
      if (changed.count !== 1) return changed;
      const stockItem = await this.prisma.stockItem.findUnique({
        where: { id: Number(stockItemId) },
        select: { productId: true },
      });
      await this.prisma.stockMovement.create({
        data: {
          productId: stockItem.productId,
          branchId: Number(branchId),
          qty: -1,
          type: 'CLAIM_REPLACEMENT',
          refType: 'WARRANTY_CLAIM',
          refId: Number(claimId),
          stockItemId: Number(stockItemId),
          previousStockStatus: 'IN_STOCK',
          resultingStockStatus: 'SOLD',
          performedByEmployeeId: employeeId ? Number(employeeId) : null,
          note: `Warranty claim replacement #${claimId}`,
        },
      });
      return changed;
    });
  }

  updateDeviceStatus(deviceId, status) {
    return this.prisma.device.update({
      where: { id: Number(deviceId) },
      data: { status },
    });
  }

  publishPassportEvent(event) {
    return publishDevicePassportEvent(this.prisma, event);
  }

  createCompletionCommand(data) {
    return this.prisma.warrantyClaimCompletionCommand.create({ data });
  }

  updateWithEvent(warrantyClaimId, data, event) {
    return this.prisma.warrantyClaim.update({
      where: { id: Number(warrantyClaimId) },
      data: {
        ...data,
        events: {
          create: event,
        },
      },
      include: warrantyClaimDetailInclude,
    });
  }
}

module.exports = new UpdateWarrantyClaimStatusRepository();
module.exports.UpdateWarrantyClaimStatusRepository =
  UpdateWarrantyClaimStatusRepository;
module.exports.warrantyClaimDetailInclude = warrantyClaimDetailInclude;
