const prisma = require('../../../../database/prisma/client');

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
  deviceIntake: {
    include: {
      snapshot: true,
      consent: true,
      photos: true,
    },
  },
  subcontracts: {
    where: { status: { in: ['SENT', 'RETURN_REQUESTED'] } },
    orderBy: [{ sentAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: {
      id: true,
      expensePayeeId: true,
      status: true,
      providerName: true,
      providerPhone: true,
      workScope: true,
      sentAt: true,
      expectedReturnAt: true,
      returnRequestedAt: true,
    },
  },
  delivery: true,
};

class ListRepairJobsRepository {
  constructor(client = prisma) {
    this.prisma = client;
  }

  findMany(branchId, filters) {
    return this.prisma.repairJob.findMany({
      where: {
        branchId: Number(branchId),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.stockItemId ? { stockItemId: filters.stockItemId } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
      },
      include: repairJobDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    });
  }
}

module.exports = new ListRepairJobsRepository();
module.exports.ListRepairJobsRepository = ListRepairJobsRepository;
module.exports.repairJobDetailInclude = repairJobDetailInclude;
