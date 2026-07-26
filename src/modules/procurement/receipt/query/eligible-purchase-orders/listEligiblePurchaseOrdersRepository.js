const { prisma } = require('../../../../../../lib/prisma');

const eligiblePurchaseOrderSelect = {
  id: true,
  code: true,
  status: true,
  createdAt: true,
  supplier: { select: { id: true, name: true } },
};

class ListEligiblePurchaseOrdersRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  findMany(branchId) {
    return this.client.purchaseOrder.findMany({
      where: {
        branchId,
        status: { in: ['PENDING', 'PARTIALLY_RECEIVED'] },
      },
      select: eligiblePurchaseOrderSelect,
      orderBy: { createdAt: 'desc' },
    });
  }
}

module.exports = new ListEligiblePurchaseOrdersRepository();
module.exports.ListEligiblePurchaseOrdersRepository = ListEligiblePurchaseOrdersRepository;
module.exports.eligiblePurchaseOrderSelect = eligiblePurchaseOrderSelect;
