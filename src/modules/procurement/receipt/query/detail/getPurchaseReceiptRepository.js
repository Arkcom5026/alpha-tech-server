const { prisma } = require('../../../../../../lib/prisma');

const receiptDetailInclude = {
  items: {
    select: {
      id: true,
      quantity: true,
      purchaseOrderItem: {
        select: {
          product: {
            select: {
              name: true,
              unit: { select: { name: true } },
            },
          },
        },
      },
    },
  },
  purchaseOrder: {
    select: {
      id: true,
      code: true,
      supplier: {
        select: {
          id: true,
          name: true,
          creditLimit: true,
          creditBalance: true,
        },
      },
    },
  },
};

class GetPurchaseReceiptRepository {
  constructor(client = prisma) {
    this.client = client;
  }

  async findReceiptById(id, branchId) {
    return this.client.purchaseOrderReceipt.findFirst({
      where: { id, branchId },
      include: receiptDetailInclude,
    });
  }

  async findReceiptIdsByPurchaseOrderId(purchaseOrderId) {
    const rows = await this.client.purchaseOrderReceipt.findMany({
      where: { purchaseOrderId },
      select: { id: true },
    });

    return rows.map((row) => row.id);
  }

  async findPaymentLinksByReceiptIds(receiptIds) {
    if (!receiptIds.length) return [];

    return this.client.supplierPaymentReceipt.findMany({
      where: { receiptId: { in: receiptIds } },
      select: { amountPaid: true },
    });
  }
}

module.exports = new GetPurchaseReceiptRepository();
module.exports.GetPurchaseReceiptRepository = GetPurchaseReceiptRepository;
module.exports.receiptDetailInclude = receiptDetailInclude;
