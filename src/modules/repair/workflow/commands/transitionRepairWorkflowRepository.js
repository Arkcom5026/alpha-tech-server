const prisma = require('../../../../database/prisma/client');
const {
  publishDevicePassportEvent,
} = require('../../../device/passport/publish/devicePassportEventPublisher');

const repairWorkflowInclude = {
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
  device: {
    include: {
      passportEvents: {
        where: { sourceType: 'REPAIR_JOB' },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 1,
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

class TransitionRepairWorkflowRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) =>
      work(new TransitionRepairWorkflowRepository(tx))
    );
  }

  findRepairJob(repairJobId) {
    return this.prisma.repairJob.findUnique({
      where: { id: Number(repairJobId) },
      include: repairWorkflowInclude,
    });
  }

  updateLegacyStatus(repairJobId, status) {
    return this.prisma.repairJob.update({
      where: { id: Number(repairJobId) },
      data: { status },
      include: repairWorkflowInclude,
    });
  }

  publishPassportEvent(event) {
    return publishDevicePassportEvent(this.prisma, event);
  }
}

module.exports = new TransitionRepairWorkflowRepository();
module.exports.TransitionRepairWorkflowRepository = TransitionRepairWorkflowRepository;
