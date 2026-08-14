const prisma = require('../../../../database/prisma/client');

// Queue/list reads intentionally load only data consumed by mapRepairJob() and
// projectRepairOperationalState(). Historical purchase/sale graphs and full
// claim event histories belong to detail queries, not the operational queue.
const repairJobListInclude = {
  customer: { include: { user: true } },
  stockItem: {
    include: {
      product: { include: { brand: true, productType: true } },
    },
  },
  device: true,
  technician: true,
  partsUsed: { include: { product: true } },
  warrantyClaims: {
    include: { supplier: true },
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
      include: repairJobListInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      skip: filters.offset,
    });
  }
}

module.exports = new ListRepairJobsRepository();
module.exports.ListRepairJobsRepository = ListRepairJobsRepository;
module.exports.repairJobListInclude = repairJobListInclude;
// Compatibility export for older contract tests/importers during the queue cutover.
module.exports.repairJobDetailInclude = repairJobListInclude;
