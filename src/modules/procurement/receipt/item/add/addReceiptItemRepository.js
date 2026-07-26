const { Prisma } = require('@prisma/client');
const { prisma } = require('../../../../../../lib/prisma');

const D = (value) => {
  if (value instanceof Prisma.Decimal) return value;
  if (value === undefined || value === null || value === '') return new Prisma.Decimal(0);
  return new Prisma.Decimal(typeof value === 'string' ? value : String(value));
};

class AddReceiptItemRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  findReceipt(receiptId, branchId) {
    return this.client.purchaseOrderReceipt.findFirst({
      where: { id: receiptId, branchId },
      include: { purchaseOrder: true },
    });
  }

  findPurchaseOrderItem(purchaseOrderItemId) {
    return this.client.purchaseOrderItem.findUnique({
      where: { id: purchaseOrderItemId },
      include: { product: true, purchaseOrder: true },
    });
  }

  findExisting(receiptId, purchaseOrderItemId, branchId) {
    return this.client.purchaseOrderReceiptItem.findFirst({
      where: { receiptId, purchaseOrderItemId, receipt: { branchId } },
      include: { stockItems: true },
    });
  }

  sumOtherReceived(purchaseOrderItemId, branchId, existingId) {
    return this.client.purchaseOrderReceiptItem.aggregate({
      where: {
        purchaseOrderItemId,
        receipt: { branchId },
        ...(existingId ? { NOT: { id: existingId } } : {}),
      },
      _sum: { quantity: true },
    });
  }

  save({ existingItem, receiptId, purchaseOrderItemId, quantity, costPrice, productId, branchId }) {
    return this.client.$transaction(async (tx) => {
      const item = existingItem
        ? await tx.purchaseOrderReceiptItem.update({
            where: { id: existingItem.id },
            data: { quantity, costPrice: D(costPrice) },
          })
        : await tx.purchaseOrderReceiptItem.create({
            data: { receiptId, purchaseOrderItemId, quantity, costPrice: D(costPrice) },
          });

      await tx.branchPrice.upsert({
        where: { productId_branchId: { productId, branchId } },
        update: { costPrice: D(costPrice) },
        create: { productId, branchId, costPrice: D(costPrice) },
      });

      return item;
    }, { timeout: 15000 });
  }
}

module.exports = new AddReceiptItemRepository();
module.exports.AddReceiptItemRepository = AddReceiptItemRepository;
