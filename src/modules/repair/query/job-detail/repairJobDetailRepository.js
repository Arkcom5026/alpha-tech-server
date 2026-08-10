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
};

class RepairJobDetailRepository {
  constructor(client = null) {
    this.client = client;
  }

  getPrisma() {
    if (!this.client) {
      this.client = require('../../../../database/prisma/client');
    }
    return this.client;
  }

  async findById(branchId, repairJobId) {
    const prisma = this.getPrisma();
    const id = Number(repairJobId);
    const branch = Number(branchId);
    const job = await prisma.repairJob.findFirst({
      where: {
        id,
        branchId: branch,
      },
      include: repairJobDetailInclude,
    });
    if (!job) return null;

    const serializedPartMovementsPromise = prisma.stockMovement.findMany({
      where: {
        branchId: branch,
        refType: 'REPAIR_JOB_PART_USAGE',
        refId: id,
        stockItemId: { not: null },
      },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        productId: true,
        qty: true,
        stockItemId: true,
        previousStockStatus: true,
        resultingStockStatus: true,
        occurredAt: true,
        performedByEmployeeId: true,
        stockItem: {
          select: {
            id: true,
            barcode: true,
            serialNumber: true,
            status: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!job.deviceId) {
      const serializedPartMovements = await serializedPartMovementsPromise;
      return { ...job, serializedPartMovements };
    }

    const eventScope = {
      deviceId: Number(job.deviceId),
      branchId: branch,
      sourceType: 'REPAIR_JOB',
      sourceId: String(id),
    };

    const [repairWorkflowEvent, repairDiagnosisEvent, repairWorkflowHistory, serializedPartMovements] = await Promise.all([
      prisma.devicePassportEvent.findFirst({
        where: eventScope,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.devicePassportEvent.findFirst({
        where: {
          ...eventScope,
          eventType: 'DIAGNOSIS_COMPLETED',
        },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.devicePassportEvent.findMany({
        where: eventScope,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: {
          id: true,
          eventType: true,
          title: true,
          description: true,
          occurredAt: true,
          metadata: true,
        },
      }),
      serializedPartMovementsPromise,
    ]);

    return {
      ...job,
      repairWorkflowEvent,
      repairDiagnosisEvent,
      repairWorkflowHistory,
      serializedPartMovements,
    };
  }
}

module.exports = new RepairJobDetailRepository();
module.exports.RepairJobDetailRepository = RepairJobDetailRepository;
module.exports.repairJobDetailInclude = repairJobDetailInclude;
