'use strict';

const { prisma } = require('../../../../../lib/prisma');

const findReceipt = ({ receiptId, branchId }) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { id: receiptId, branchId },
    select: { id: true },
  });

const markCompleted = ({ receiptId, branchId }) =>
  prisma.purchaseOrderReceipt.updateMany({
    where: { id: receiptId, branchId },
    data: { statusReceipt: 'COMPLETED' },
  });

const findCompletedReceipt = ({ receiptId, branchId }) =>
  prisma.purchaseOrderReceipt.findFirst({
    where: { id: receiptId, branchId },
    select: { id: true, code: true, statusReceipt: true },
  });

module.exports = {
  findReceipt,
  markCompleted,
  findCompletedReceipt,
};
