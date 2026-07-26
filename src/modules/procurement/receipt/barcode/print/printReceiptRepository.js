const { prisma } = require('../../../../../../lib/prisma');

const print = async ({ id, branchId }) => {
  await prisma.purchaseOrderReceipt.updateMany({
    where: { id, branchId },
    data: { printed: true },
  });

  return prisma.barcodeReceiptItem.findMany({
    where: { purchaseOrderReceiptId: id, branchId },
    select: { barcode: true, kind: true, receiptItemId: true },
    orderBy: { runningNumber: 'asc' },
  });
};

module.exports = { print };
