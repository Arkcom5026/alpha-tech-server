const { prisma } = require('../../../../../../lib/prisma');

const receiptPurchaseOrderInclude = {
  supplier: true,
  items: {
    include: {
      product: {
        include: {
          productType: true,
          brand: true,
          unit: true,
        },
      },
      receipts: true,
    },
  },
};

class GetReceiptPurchaseOrderRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  findByIdAndBranch(id, branchId) {
    return this.client.purchaseOrder.findFirst({
      where: { id, branchId },
      include: receiptPurchaseOrderInclude,
    });
  }
}

module.exports = new GetReceiptPurchaseOrderRepository();
module.exports.GetReceiptPurchaseOrderRepository = GetReceiptPurchaseOrderRepository;
module.exports.receiptPurchaseOrderInclude = receiptPurchaseOrderInclude;
