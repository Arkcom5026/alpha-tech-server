const { prisma } = require('../../../../../lib/prisma');
const { SALE_DOCUMENT_INCLUDE } = require('../../documents/contracts/saleDocumentContract');

const findCompletionCommand = ({ branchId, commandKey }) =>
  prisma.salesCompletionCommand.findUnique({
    where: { branchId_commandKey: { branchId, commandKey } },
    include: { sale: { include: SALE_DOCUMENT_INCLUDE } },
  });

const findActiveSalePayments = (saleId) =>
  prisma.payment.findMany({
    where: { saleId, isCancelled: false },
    include: { items: true },
    orderBy: { receivedAt: 'asc' },
  });

const runCompletionTransaction = (operation) =>
  prisma.$transaction(operation, { timeout: 20000, maxWait: 20000 });

module.exports = {
  findCompletionCommand,
  findActiveSalePayments,
  runCompletionTransaction,
};
