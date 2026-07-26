const { Prisma } = require('@prisma/client');
const { prisma } = require('../../../../../../lib/prisma');

const D = (value) => {
  if (value instanceof Prisma.Decimal) return value;
  if (value === undefined || value === null || value === '') return new Prisma.Decimal(0);
  return new Prisma.Decimal(typeof value === 'string' ? value : String(value));
};

class UpdateReceiptItemRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  findExisting(receiptId, purchaseOrderItemId, branchId) {
    return this.client.purchaseOrderReceiptItem.findFirst({
      where: { receiptId, purchaseOrderItemId, receipt: { branchId } },
      include: {
        receipt: true,
        purchaseOrderItem: { include: { purchaseOrder: true } },
        stockItems: true,
      },
    });
  }

  sumOtherReceived(purchaseOrderItemId, branchId, existingId) {
    return this.client.purchaseOrderReceiptItem.aggregate({
      where: {
        purchaseOrderItemId,
        receipt: { branchId },
        NOT: { id: existingId },
      },
      _sum: { quantity: true },
    });
  }

  save({ existingItem, quantity, costPrice }) {
    return this.client.$transaction(async (tx) => {
      const updated = await tx.purchaseOrderReceiptItem.update({
        where: { id: existingItem.id },
        data: { quantity, costPrice: D(costPrice) },
      });

      await tx.branchPrice.upsert({
        where: {
          productId_branchId: {
            productId: existingItem.purchaseOrderItem.productId,
            branchId: existingItem.receipt.branchId,
          },
        },
        update: { costPrice: D(costPrice) },
        create: {
          productId: existingItem.purchaseOrderItem.productId,
          branchId: existingItem.receipt.branchId,
          costPrice: D(costPrice),
        },
      });

      return updated;
    }, { timeout: 15000 });
  }
}

module.exports = new UpdateReceiptItemRepository();
module.exports.UpdateReceiptItemRepository = UpdateReceiptItemRepository;
