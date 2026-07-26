const { prisma } = require('../../../../../lib/prisma');

class DeletePurchaseReceiptRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  findByIdAndBranch(id, branchId) {
    return this.client.purchaseOrderReceipt.findFirst({ where: { id, branchId } });
  }

  deleteById(id) {
    return this.client.purchaseOrderReceipt.delete({ where: { id } });
  }
}

module.exports = new DeletePurchaseReceiptRepository();
module.exports.DeletePurchaseReceiptRepository = DeletePurchaseReceiptRepository;
