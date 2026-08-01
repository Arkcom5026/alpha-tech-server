const prismaImport = require('../../../../../lib/prisma');
const prisma = prismaImport?.prisma || prismaImport;

const findReceipt = ({ receiptId, branchId }) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { id: receiptId, branchId },
    select: { id: true },
  });

const completeReceipt = ({ receiptId, branchId }) =>
  prisma.purchaseOrderReceipt.updateMany({
    where: { id: receiptId, branchId },
    data: { statusReceipt: 'COMPLETED' },
  });

const getReceiptProjection = ({ receiptId, branchId }) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { id: receiptId, branchId },
    select: { id: true, code: true, statusReceipt: true },
  });

module.exports = {
  findReceipt,
  completeReceipt,
  getReceiptProjection,
};
