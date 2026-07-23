const { prisma, Prisma } = require('../../../../../lib/prisma');
const { decimal } = require('../utils/saleReturnMoney');

const saleReturnResultInclude = {
  sale: { select: { id: true, code: true } },
  items: true,
  saleReturnItemSimples: true,
  refundTransaction: true,
};

const findSaleForReturn = ({ saleId, branchId, client = prisma }) =>
  client.sale.findFirst({
    where: { id: saleId, branchId },
    include: {
      customer: true,
      payments: {
        where: { isCancelled: false },
        include: {
          items: {
            include: {
              refundTransactions: {
                select: { amount: true },
              },
            },
          },
        },
        orderBy: { receivedAt: 'asc' },
      },
      items: {
        include: {
          stockItem: { include: { product: true } },
          returnItems: true,
        },
      },
      simpleItems: {
        include: {
          product: true,
          simpleLots: true,
          SaleReturnItemSimple: true,
        },
      },
    },
  });

const findCompletionCommand = ({ branchId, commandId, client = prisma }) =>
  client.saleReturnCompletionCommand.findUnique({
    where: { branchId_commandKey: { branchId, commandKey: commandId } },
    include: { saleReturn: { include: saleReturnResultInclude } },
  });

const findEmployeeReturnAuthority = ({ employeeId, branchId, client = prisma }) =>
  client.employeeProfile.findFirst({
    where: { id: employeeId, branchId, active: true, approved: true },
    select: { id: true, v2Role: true },
  });

const runSaleReturnTransaction = (work) =>
  prisma.$transaction((tx) => work(tx), {
    timeout: 30000,
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

const createSaleReturnHeader = ({
  client,
  code,
  command,
  branchId,
  employeeId,
  projection,
  occurredAt,
}) => client.saleReturn.create({
  data: {
    code,
    saleId: command.saleId,
    employeeId,
    refundedByEmployeeId: projection.actualRefundTotal.gt(0) ? employeeId : null,
    branchId,
    totalRefund: projection.eligibleTotal,
    refundedAmount: projection.actualRefundTotal,
    deductedAmount: projection.deductedAmount,
    isFullyRefunded: projection.deductedAmount.eq(0),
    refundMethod: command.refunds[0]?.method || 'OTHER',
    status: 'COMPLETED',
    returnType: 'REFUND',
    reason: command.reason || null,
    approvedAt: occurredAt,
    stockRestoredAt: occurredAt,
    completedAt: occurredAt,
  },
});

const restoreSerializedItem = async ({
  client,
  item,
  saleReturnId,
  branchId,
  occurredAt,
  movement,
}) => {
  const changed = await client.stockItem.updateMany({
    where: { id: item.source.stockItemId, branchId, status: 'SOLD' },
    data: { status: 'IN_STOCK' },
  });
  if (changed.count !== 1) return false;
  await client.saleReturnItem.create({
    data: {
      saleReturnId,
      saleItemId: item.saleItemId,
      refundAmount: decimal(item.refundAmount),
      reason: item.reason || null,
    },
  });
  await client.saleItem.update({
    where: { id: item.saleItemId },
    data: {
      returnedQuantity: { increment: decimal(1) },
      refundedAmount: { increment: decimal(item.refundAmount) },
      lastReturnedAt: occurredAt,
    },
  });
  await client.stockMovement.create({ data: movement });
  return true;
};

const restoreSimpleItem = async ({
  client,
  item,
  saleReturnId,
  branchId,
  occurredAt,
  movement,
}) => {
  await client.saleReturnItemSimple.create({
    data: {
      saleReturnId,
      saleItemSimpleId: item.saleItemSimpleId,
      quantity: decimal(item.quantity),
      refundAmount: decimal(item.refundAmount),
      reason: item.reason || null,
    },
  });
  await client.saleItemSimple.update({
    where: { id: item.saleItemSimpleId },
    data: {
      returnedQuantity: { increment: decimal(item.quantity) },
      refundedAmount: { increment: decimal(item.refundAmount) },
      lastReturnedAt: occurredAt,
    },
  });
  await client.simpleLot.update({
    where: { id: item.source.simpleLotId },
    data: { qtyRemaining: { increment: decimal(item.quantity) } },
  });
  await client.stockBalance.upsert({
    where: {
      productId_branchId: {
        productId: item.source.productId,
        branchId,
      },
    },
    create: {
      productId: item.source.productId,
      branchId,
      quantity: decimal(item.quantity),
    },
    update: {
      quantity: { increment: decimal(item.quantity) },
    },
  });
  await client.stockMovement.create({ data: movement });
};

const createRefundEvidence = ({ client, command, saleReturnId, branchId, employeeId, occurredAt }) => {
  if (!command.refunds.length) return Promise.resolve();
  return client.refundTransaction.createMany({
    data: command.refunds.map((refund) => ({
      saleReturnId,
      amount: decimal(refund.amount),
      deducted: decimal(0),
      method: refund.method,
      sourcePaymentItemId: refund.sourcePaymentItemId,
      referenceNo: refund.referenceNo,
      note: refund.note,
      refundedByEmployeeId: employeeId,
      branchId,
      refundedAt: occurredAt,
    })),
  });
};

const createCompletionCommand = ({ client, branchId, command, saleReturnId }) =>
  client.saleReturnCompletionCommand.create({
    data: {
      branchId,
      commandKey: command.commandId,
      requestHash: command.requestHash,
      saleReturnId,
    },
  });

module.exports = {
  saleReturnResultInclude,
  findSaleForReturn,
  findCompletionCommand,
  findEmployeeReturnAuthority,
  runSaleReturnTransaction,
  createSaleReturnHeader,
  restoreSerializedItem,
  restoreSimpleItem,
  createRefundEvidence,
  createCompletionCommand,
};
