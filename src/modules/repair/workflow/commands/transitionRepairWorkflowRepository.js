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
  device: true,
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
  deviceIntake: {
    include: {
      consent: true,
      photos: { orderBy: { createdAt: 'asc' } },
    },
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

  async findRepairJob(repairJobId) {
    const id = Number(repairJobId);
    const job = await this.prisma.repairJob.findUnique({
      where: { id },
      include: repairWorkflowInclude,
    });
    if (!job?.deviceId || !job.device) return job;

    const eventScope = {
      deviceId: Number(job.deviceId),
      branchId: Number(job.branchId),
      sourceType: 'REPAIR_JOB',
      sourceId: String(id),
    };
    const [latestWorkflowEvent, creationEvent] = await Promise.all([
      this.prisma.devicePassportEvent.findFirst({
        where: eventScope,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.devicePassportEvent.findFirst({
        where: { ...eventScope, eventType: 'REPAIR_CREATED' },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        select: { metadata: true },
      }),
    ]);

    return {
      ...job,
      preAgreedService: creationEvent?.metadata?.preAgreedService || null,
      device: {
        ...job.device,
        passportEvents: latestWorkflowEvent ? [latestWorkflowEvent] : [],
      },
    };
  }

  updateLegacyStatus(repairJobId, status, extraData = {}) {
    return this.prisma.repairJob.update({
      where: { id: Number(repairJobId) },
      data: { status, ...extraData },
      include: repairWorkflowInclude,
    });
  }

  publishPassportEvent(event) {
    return publishDevicePassportEvent(this.prisma, event);
  }
}

module.exports = new TransitionRepairWorkflowRepository();
module.exports.TransitionRepairWorkflowRepository = TransitionRepairWorkflowRepository;
module.exports.repairWorkflowInclude = repairWorkflowInclude;
