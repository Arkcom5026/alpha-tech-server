const prisma = require('../../../database/prisma/client');

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

class UpdateRepairJobStatusRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  transaction(work) {
    return this.prisma.$transaction((tx) =>
      work(new UpdateRepairJobStatusRepository(tx))
    );
  }

  findJob(branchId, repairJobId) {
    return this.prisma.repairJob.findFirst({
      where: {
        id: Number(repairJobId),
        branchId: Number(branchId),
      },
      include: repairJobDetailInclude,
    });
  }

  findTechnician(technicianId) {
    return this.prisma.employeeProfile.findUnique({
      where: { id: Number(technicianId) },
    });
  }

  updateJob(repairJobId, data) {
    return this.prisma.repairJob.update({
      where: { id: Number(repairJobId) },
      data,
      include: repairJobDetailInclude,
    });
  }
}

module.exports = new UpdateRepairJobStatusRepository();
module.exports.UpdateRepairJobStatusRepository = UpdateRepairJobStatusRepository;
