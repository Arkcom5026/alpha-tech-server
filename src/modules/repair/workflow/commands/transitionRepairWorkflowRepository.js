const prisma = require('../../../../database/prisma/client');
const {
  publishDevicePassportEvent,
} = require('../../../device/passport/publish/devicePassportEventPublisher');
const {
  findLatestRepairWorkflowEvent,
  findRepairWorkflowHistory,
  publishRepairWorkflowEvent,
} = require('../events/repairWorkflowEventStore');

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
    if (!job) return null;

    const [repairWorkflowEvent, repairWorkflowHistory] = await Promise.all([
      findLatestRepairWorkflowEvent(this.prisma, {
        repairJobId: id,
        branchId: job.branchId,
      }),
      findRepairWorkflowHistory(this.prisma, {
        repairJobId: id,
        branchId: job.branchId,
        take: 50,
      }),
    ]);

    let latestPassportEvent = null;
    let creationPassportEvent = null;
    if (job.deviceId && job.device) {
      const eventScope = {
        deviceId: Number(job.deviceId),
        branchId: Number(job.branchId),
        sourceType: 'REPAIR_JOB',
        sourceId: String(id),
      };
      [latestPassportEvent, creationPassportEvent] = await Promise.all([
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
    }

    const creationRepairEvent = [...repairWorkflowHistory]
      .reverse()
      .find((event) => event.eventType === 'REPAIR_CREATED') || null;

    return {
      ...job,
      repairWorkflowEvent,
      repairWorkflowHistory,
      preAgreedService:
        creationRepairEvent?.metadata?.preAgreedService ||
        creationPassportEvent?.metadata?.preAgreedService ||
        null,
      device: job.device
        ? {
            ...job.device,
            passportEvents: latestPassportEvent ? [latestPassportEvent] : [],
          }
        : null,
    };
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

  updateLegacyStatus(repairJobId, status, extraData = {}) {
    return this.prisma.repairJob.update({
      where: { id: Number(repairJobId) },
      data: { status, ...extraData },
      include: repairWorkflowInclude,
    });
  }

  publishWorkflowEvent(event) {
    return publishRepairWorkflowEvent(this.prisma, event);
  }

  publishPassportEvent(event) {
    return publishDevicePassportEvent(this.prisma, event);
  }
}

module.exports = new TransitionRepairWorkflowRepository();
module.exports.TransitionRepairWorkflowRepository = TransitionRepairWorkflowRepository;
module.exports.repairWorkflowInclude = repairWorkflowInclude;
