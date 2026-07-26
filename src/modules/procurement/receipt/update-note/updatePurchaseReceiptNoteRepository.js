const { prisma } = require('../../../../../lib/prisma');

class UpdatePurchaseReceiptNoteRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  findByIdAndBranch(id, branchId) {
    return this.client.purchaseOrderReceipt.findFirst({ where: { id, branchId } });
  }

  updateNote(id, note) {
    return this.client.purchaseOrderReceipt.update({
      where: { id },
      data: { note: note || null },
      include: {
        purchaseOrder: { select: { code: true, supplier: { select: { name: true } } } },
      },
    });
  }
}

module.exports = new UpdatePurchaseReceiptNoteRepository();
module.exports.UpdatePurchaseReceiptNoteRepository = UpdatePurchaseReceiptNoteRepository;
