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
    if (!job?.deviceId) return job;

    const repairWorkflowEvent = await prisma.devicePassportEvent.findFirst({
      where: {
        deviceId: Number(job.deviceId),
        branchId: branch,
        sourceType: 'REPAIR_JOB',
        sourceId: String(id),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });

    return { ...job, repairWorkflowEvent };
  }
}

module.exports = new RepairJobDetailRepository();
module.exports.RepairJobDetailRepository = RepairJobDetailRepository;
module.exports.repairJobDetailInclude = repairJobDetailInclude;
