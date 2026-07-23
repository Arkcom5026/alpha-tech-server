const { Prisma } = require('../../../../lib/prisma');
const { SalesError } = require('../errors/salesError');

const D = (value) => new Prisma.Decimal(Number(value || 0).toFixed(2));
const n = (value) => Number(value || 0);

const consumeDeposit = async (tx, { item, sale, paymentId, branchId }) => {
  const deposit = await tx.customerDeposit.findFirst({
    where: {
      id: item.customerDepositId,
      branchId,
      customerId: sale.customerId,
      status: 'ACTIVE',
    },
    select: { id: true, usedAmount: true, totalAmount: true },
  });
  if (!deposit) {
    throw new SalesError(400, 'DEPOSIT_NOT_USABLE', 'Deposit is not active or does not belong to this branch and customer');
  }
  const remaining = n(deposit.totalAmount) - n(deposit.usedAmount);
  if (item.amount > remaining + 0.001) {
    throw new SalesError(409, 'DEPOSIT_BALANCE_CONFLICT', 'Deposit balance is insufficient');
  }

  const updated = await tx.customerDeposit.updateMany({
    where: { id: deposit.id, status: 'ACTIVE', usedAmount: deposit.usedAmount },
    data: {
      usedAmount: { increment: D(item.amount) },
      ...(Math.abs(item.amount - remaining) <= 0.001 ? { status: 'USED', usedSaleId: sale.id } : {}),
    },
  });
  if (updated.count !== 1) {
    throw new SalesError(409, 'DEPOSIT_BALANCE_CONFLICT', 'Deposit was used by another transaction');
  }
  await tx.depositUsage.create({
    data: {
      customerDepositId: deposit.id,
      saleId: sale.id,
      paymentId,
      amountUsed: D(item.amount),
    },
  });
};

const projectSalePaymentStatus = async (tx, saleId) => {
  const sale = await tx.sale.findUnique({ where: { id: saleId }, select: { totalAmount: true, status: true } });
  if (!sale) throw new SalesError(404, 'SALE_NOT_FOUND', 'Sale not found');
  const aggregate = await tx.paymentItem.aggregate({
    _sum: { amount: true },
    where: { payment: { saleId, isCancelled: false } },
  });
  const paidAmount = aggregate._sum.amount || D(0);
  const paidNumber = n(paidAmount);
  const total = n(sale.totalAmount);
  const paid = paidNumber + 0.001 >= total;
  const statusPayment = paid ? 'PAID' : paidNumber > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
  const paidAt = paid
    ? (await tx.payment.findFirst({
        where: { saleId, isCancelled: false },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      }))?.receivedAt || new Date()
    : null;
  await tx.sale.update({
    where: { id: saleId },
    data: { paid, paidAt, paidAmount, statusPayment },
  });
  return { paid, paidAt, paidAmount, statusPayment, totalAmount: sale.totalAmount };
};

const postPaymentEvidence = async (tx, { sale, branchId, employeeId, payment, code }) => {
  if (!payment.paymentItems.length) return { payments: [], summary: await projectSalePaymentStatus(tx, sale.id) };
  const receivedAt = payment.receivedAt ? new Date(payment.receivedAt) : new Date();
  if (Number.isNaN(receivedAt.getTime())) {
    throw new SalesError(400, 'INVALID_RECEIVED_AT', 'Invalid payment receivedAt');
  }
  const created = await tx.payment.create({
    data: {
      code,
      saleId: sale.id,
      branchId,
      employeeProfileId: employeeId || null,
      receivedAt,
      note: payment.note,
      items: {
        create: payment.paymentItems.map((item) => ({
          paymentMethod: item.paymentMethod,
          amount: D(item.amount),
          note: item.note,
          slipImage: item.slipImage,
          cardRef: item.cardRef,
          govImage: item.govImage,
        })),
      },
    },
    include: { items: true },
  });
  for (const item of payment.paymentItems) {
    if (item.paymentMethod === 'DEPOSIT') {
      await consumeDeposit(tx, { item, sale, paymentId: created.id, branchId });
    }
  }
  return { payments: [created], summary: await projectSalePaymentStatus(tx, sale.id) };
};

module.exports = { postPaymentEvidence, projectSalePaymentStatus, consumeDeposit };
