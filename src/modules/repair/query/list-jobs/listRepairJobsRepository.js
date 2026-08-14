const prisma = require('../../../../database/prisma/client');

// Queue/list reads intentionally load only data consumed by mapRepairJob(),
// queue projection and projectRepairOperationalState(). Parts and warranty-claim
// graphs belong to Detail/Claim bounded contexts and must not inflate every queue
// refresh.
const repairJobListInclude = {
  customer: { include: { user: true } },
  stockItem: {
    include: {
      product: { include: { brand: true, productType: true } },
    },
  },
  device: true,
  technician: true,
  deviceIntake: {
    select: {
      id: true,
      assetDescription: true,
      snapshot: true,
      consent: { select: { id: true } },
      photos: {
        select: { category: true },
      },
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
