const { prisma } = require('../../../../../../lib/prisma');

const receiptItemsInclude = {
  purchaseOrderItem: {
    include: {
      product: { select: { id: true, name: true, unit: true } },
      purchaseOrder: { select: { id: true, code: true } },
    },
  },
  stockItems: true,
};

class ListReceiptItemsRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  findBranchScopedReceipt(receiptId, branchId) {
    return this.client.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId },
      select: { id: true },
    });
  }

  findItems(receiptId) {
    return this.client.purchaseOrderReceiptItem.findMany({
      where: { receiptId },
      include: receiptItemsInclude,
      orderBy: [{ id: 'asc' }],
    });
  }
}

module.exports = new ListReceiptItemsRepository();
module.exports.ListReceiptItemsRepository = ListReceiptItemsRepository;
module.exports.receiptItemsInclude = receiptItemsInclude;
