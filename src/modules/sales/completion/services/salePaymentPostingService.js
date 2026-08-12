const { Prisma } = require('../../../../../lib/prisma');
const { SaleCompletionError: SalesError } = require('../contracts/saleCompletionError');
const { assertDepositBalance } = require('../policies/saleDepositPolicy');
const {
  calculateAvailableCustomerMoney,
  getCustomerMoneySourceState,
} = require('../../../customer-money/balance/customerMoneySourcePoolService');
const {
  updateCustomerMoneyBalance,
} = require('../../../customer-money/balance/updateCustomerMoneyBalanceService');
const {
  acquireCustomerMoneyTransactionLock,
} = require('../../../customer-money/shared/customerMoneyTransactionLock');

const D = (value) => new Prisma.Decimal(Number(value || 0).toFixed(2));
const n = (value) => Number(value || 0);

const refreshCustomerMoneyBalance = async (tx, { branchId, customerId }) => {
  if (!tx?.customerDeposit?.findMany || !tx?.customerReceipt?.findMany) return null;
  const availableAmount = await calculateAvailableCustomerMoney(tx, { branchId, customerId });
  await updateCustomerMoneyBalance({ client: tx, branchId, customerId, availableAmount });
  return availableAmount;
};

const consumeDeposit = async (tx, { item, sale, paymentId, branchId }) => {
  const customerId = Number(sale?.customerId);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new SalesError(400, 'DEPOSIT_CUSTOMER_REQUIRED', 'Deposit payment requires a customer sale');
  }

  await acquireCustomerMoneyTransactionLock(tx, customerId);
  const deposit = await tx.customerDeposit.findFirst({
    where: {
      id: item.customerDepositId,
      branchId,
      customerId,
      status: 'ACTIVE',
    },
    select: { id: true, usedAmount: true, totalAmount: true },
  });
  if (!deposit) {
    throw new SalesError(400, 'DEPOSIT_NOT_USABLE', 'Deposit is not active or does not belong to this branch and customer');
  }

  const sourceState = await getCustomerMoneySourceState(tx, {
    branchId,
    customerId,
    sourceType: 'CUSTOMER_DEPOSIT',
    sourceId: deposit.id,
  });
  const requestedAmount = D(item.amount);
  if (
    !sourceState.source
    || sourceState.uncoveredLegacyReservation.greaterThan(0)
    || requestedAmount.greaterThan(sourceState.availableAmount)
  ) {
    throw new SalesError(
      409,
      'DEPOSIT_CUSTOMER_MONEY_RESERVED',
      'Deposit balance is reserved by an active legacy Customer Money settlement',
    );
  }

  const remaining = assertDepositBalance({
    amount: item.amount,
    totalAmount: deposit.totalAmount,
    usedAmount: deposit.usedAmount,
  });

  const updated = await tx.customerDeposit.updateMany({
    where: { id: deposit.id, status: 'ACTIVE', usedAmount: deposit.usedAmount },
    data: {
      usedAmount: { increment: requestedAmount },
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
      amountUsed: requestedAmount,
    },
  });
  await refreshCustomerMoneyBalance(tx, { branchId, customerId });
};

const acquireSalePaymentProjectionLock = async (tx, saleId) => {
  if (!tx?.$queryRaw) return;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${-1001}, ${Number(saleId)})`;
};

const aggregateActiveSettlementAmount = async (tx, saleId) => {
  if (!tx?.customerMoneySettlementLine?.aggregate) {
    return { _sum: { appliedAmount: null } };
  }
  return tx.customerMoneySettlementLine.aggregate({
    _sum: { appliedAmount: true },
    where: {
      saleId,
      settlement: { status: 'ACTIVE', settlementType: 'DELIVERY_CREDIT' },
    },
  });
};

const aggregateActiveReceiptAllocationAmount = async (tx, saleId) => {
  if (!tx?.customerReceiptAllocation?.aggregate) {
    return { _sum: { amount: null } };
  }
  return tx.customerReceiptAllocation.aggregate({
    _sum: { amount: true },
    where: {
      saleId,
      receipt: { status: { not: 'CANCELLED' } },
    },
  });
};

const findLatestActiveSettlement = async (tx, saleId) => {
  if (!tx?.customerMoneySettlement?.findFirst) return null;
  return tx.customerMoneySettlement.findFirst({
    where: {
      status: 'ACTIVE',
      settlementType: 'DELIVERY_CREDIT',
      lines: { some: { saleId } },
    },
    orderBy: { settledAt: 'desc' },
    select: { settledAt: true },
  });
};

const findLatestActiveReceiptAllocation = async (tx, saleId) => {
  if (!tx?.customerReceiptAllocation?.findFirst) return null;
  return tx.customerReceiptAllocation.findFirst({
    where: {
      saleId,
      receipt: { status: { not: 'CANCELLED' } },
    },
    orderBy: { allocatedAt: 'desc' },
    select: { allocatedAt: true },
  });
};

const projectSalePaymentStatus = async (tx, saleId) => {
  await acquireSalePaymentProjectionLock(tx, saleId);

  const sale = await tx.sale.findUnique({ where: { id: saleId }, select: { totalAmount: true, status: true } });
  if (!sale) throw new SalesError(404, 'SALE_NOT_FOUND', 'Sale not found');

  const [paymentAggregate, receiptAllocationAggregate, settlementAggregate] = await Promise.all([
    tx.paymentItem.aggregate({
      _sum: { amount: true },
      where: { payment: { saleId, isCancelled: false } },
    }),
    aggregateActiveReceiptAllocationAmount(tx, saleId),
    aggregateActiveSettlementAmount(tx, saleId),
  ]);

  const paidAmount = D(paymentAggregate._sum.amount || 0)
    .plus(D(receiptAllocationAggregate._sum.amount || 0))
    .plus(D(settlementAggregate._sum.appliedAmount || 0));
  const paidNumber = n(paidAmount);
  const total = n(sale.totalAmount);
  const paid = paidNumber + 0.001 >= total;
  const statusPayment = paid ? 'PAID' : paidNumber > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

  let paidAt = null;
  if (paid) {
    const [latestPayment, latestReceiptAllocation, latestSettlement] = await Promise.all([
      tx.payment.findFirst({
        where: { saleId, isCancelled: false },
        orderBy: { receivedAt: 'desc' },
        select: { receivedAt: true },
      }),
      findLatestActiveReceiptAllocation(tx, saleId),
      findLatestActiveSettlement(tx, saleId),
    ]);
    const candidates = [
      latestPayment?.receivedAt,
      latestReceiptAllocation?.allocatedAt,
      latestSettlement?.settledAt,
    ]
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));
    paidAt = candidates.length
      ? new Date(Math.max(...candidates.map((value) => value.getTime())))
      : new Date();
  }

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

module.exports = {
  postPaymentEvidence,
  projectSalePaymentStatus,
  consumeDeposit,
  refreshCustomerMoneyBalance,
  acquireSalePaymentProjectionLock,
  aggregateActiveSettlementAmount,
  aggregateActiveReceiptAllocationAmount,
  findLatestActiveSettlement,
  findLatestActiveReceiptAllocation,
};