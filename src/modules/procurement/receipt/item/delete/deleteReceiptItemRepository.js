const { prisma } = require('../../../../../../lib/prisma');

class DeleteReceiptItemRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  findByIdAndBranch(id, branchId) {
    return this.client.purchaseOrderReceiptItem.findFirst({
      where: { id, receipt: { branchId } },
      include: { stockItems: true },
    });
  }

  deleteById(id) {
    return this.client.purchaseOrderReceiptItem.delete({ where: { id } });
  }
}

module.exports = new DeleteReceiptItemRepository();
module.exports.DeleteReceiptItemRepository = DeleteReceiptItemRepository;
