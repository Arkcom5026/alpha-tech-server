const { prisma } = require('../../../../../../lib/prisma');

const markPrinted = ({ id, branchId }) =>
  prisma.purchaseOrderReceipt.updateMany({
    where: { id, branchId },
    data: { printed: true },
  });

const findReceipt = ({ id, branchId }) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { id, branchId },
    select: { id: true, code: true, printed: true },
  });

module.exports = { markPrinted, findReceipt };
