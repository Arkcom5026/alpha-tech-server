class GetWarrantyClaimOptionsRepository {
  constructor(client = null) {
    this.prisma = client;
  }

  getClient() {
    if (!this.prisma) {
      this.prisma = require('../../../../database/prisma/client');
    }
    return this.prisma;
  }

  findRepairJob(branchId, repairJobId) {
    return this.getClient().repairJob.findFirst({
      where: {
        id: Number(repairJobId),
        branchId: Number(branchId),
      },
      include: {
        stockItem: {
          include: {
            purchaseOrderReceiptItem: {
              include: {
                receipt: {
                  include: { supplier: true },
                },
              },
            },
          },
        },
        device: true,
        warrantyClaims: true,
      },
    });
  }

  findLatestWorkflowEvent(branchId, repairJobId, deviceId) {
    return this.getClient().devicePassportEvent.findFirst({
      where: {
        branchId: Number(branchId),
        deviceId: Number(deviceId),
        sourceType: 'REPAIR_JOB',
        sourceId: String(repairJobId),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });
  }

  listActiveSuppliers(branchId) {
    return this.getClient().supplier.findMany({
      where: {
        branchId: Number(branchId),
        active: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
    });
  }
}

module.exports = new GetWarrantyClaimOptionsRepository();
module.exports.GetWarrantyClaimOptionsRepository = GetWarrantyClaimOptionsRepository;
