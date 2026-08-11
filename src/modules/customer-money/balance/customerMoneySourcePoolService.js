'use strict';

const { Prisma } = require('../../../../lib/prisma');

const money = (value) => new Prisma.Decimal(String(value ?? 0));

const buildError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const sourceTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const listAvailableCustomerMoneySources = async (client, { branchId, customerId }) => {
  const [receipts, deposits] = await Promise.all([
    client.customerReceipt.findMany({
      where: {
        branchId,
        customerId,
        status: 'ACTIVE',
        code: { startsWith: 'CMR-' },
        remainingAmount: { gt: 0 },
      },
      select: {
        id: true,
        remainingAmount: true,
        allocatedAmount: true,
        receivedAt: true,
        createdAt: true,
      },
      orderBy: [{ receivedAt: 'asc' }, { id: 'asc' }],
    }),
    client.customerDeposit.findMany({
      where: {
        branchId,
        customerId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        totalAmount: true,
        usedAmount: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  return [
    ...receipts.map((receipt) => ({
      sourceType: 'CUSTOMER_MONEY_RECEIPT',
      sourceId: receipt.id,
      availableAmount: money(receipt.remainingAmount),
      occurredAt: receipt.receivedAt || receipt.createdAt,
      snapshot: receipt,
    })),
    ...deposits.map((deposit) => ({
      sourceType: 'CUSTOMER_DEPOSIT',
      sourceId: deposit.id,
      availableAmount: money(deposit.totalAmount).minus(money(deposit.usedAmount)),
      occurredAt: deposit.createdAt,
      snapshot: deposit,
    })),
  ]
    .filter((source) => source.availableAmount.greaterThan(0))
    .sort((left, right) => {
      const byTime = sourceTimestamp(left.occurredAt) - sourceTimestamp(right.occurredAt);
      if (byTime !== 0) return byTime;
      if (left.sourceType !== right.sourceType) return left.sourceType.localeCompare(right.sourceType);
      return left.sourceId - right.sourceId;
    });
};

const calculateAvailableCustomerMoney = async (client, context) => {
  const sources = await listAvailableCustomerMoneySources(client, context);
  return sources.reduce((sum, source) => sum.plus(source.availableAmount), money(0));
};

const consumeCustomerMoneySources = async (client, { branchId, customerId, amount }) => {
  const requested = money(amount);
  if (requested.lessThanOrEqualTo(0)) return [];

  const sources = await listAvailableCustomerMoneySources(client, { branchId, customerId });
  const available = sources.reduce((sum, source) => sum.plus(source.availableAmount), money(0));
  if (requested.greaterThan(available)) {
    throw buildError('ยอด Customer Money พร้อมใช้ไม่เพียงพอ', 409, 'INSUFFICIENT_CUSTOMER_MONEY');
  }

  const chunks = [];
  let remaining = requested;

  for (const source of sources) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const chunkAmount = Prisma.Decimal.min(source.availableAmount, remaining);
    if (chunkAmount.lessThanOrEqualTo(0)) continue;

    if (source.sourceType === 'CUSTOMER_MONEY_RECEIPT') {
      const updated = await client.customerReceipt.updateMany({
        where: {
          id: source.sourceId,
          branchId,
          customerId,
          status: 'ACTIVE',
          remainingAmount: source.snapshot.remainingAmount,
        },
        data: {
          allocatedAmount: { increment: chunkAmount },
          remainingAmount: { decrement: chunkAmount },
        },
      });
      if (updated.count !== 1) {
        throw buildError('ยอดใบรับเงินมีการเปลี่ยนแปลงจากรายการอื่น กรุณาลองใหม่', 409, 'CUSTOMER_MONEY_SOURCE_CONFLICT');
      }
    } else if (source.sourceType === 'CUSTOMER_DEPOSIT') {
      const fullyConsumed = chunkAmount.greaterThanOrEqualTo(source.availableAmount);
      const updated = await client.customerDeposit.updateMany({
        where: {
          id: source.sourceId,
          branchId,
          customerId,
          status: 'ACTIVE',
          usedAmount: source.snapshot.usedAmount,
        },
        data: {
          usedAmount: { increment: chunkAmount },
          ...(fullyConsumed ? { status: 'USED' } : {}),
        },
      });
      if (updated.count !== 1) {
        throw buildError('ยอดเงินมัดจำมีการเปลี่ยนแปลงจากรายการอื่น กรุณาลองใหม่', 409, 'CUSTOMER_MONEY_SOURCE_CONFLICT');
      }
    } else {
      throw buildError('พบประเภทแหล่ง Customer Money ที่ระบบไม่รองรับ', 409, 'CUSTOMER_MONEY_SOURCE_UNSUPPORTED');
    }

    chunks.push({
      sourceType: source.sourceType,
      sourceId: source.sourceId,
      amount: chunkAmount,
    });
    remaining = remaining.minus(chunkAmount);
  }

  if (remaining.greaterThan(0)) {
    throw buildError('ไม่สามารถจัดสรร Customer Money ได้ครบตามยอดที่ร้องขอ', 409, 'CUSTOMER_MONEY_ALLOCATION_INCOMPLETE');
  }

  return chunks;
};

const restoreCustomerMoneySources = async (client, { branchId, customerId, applications }) => {
  for (const application of applications || []) {
    const amount = money(application.amount);
    if (amount.lessThanOrEqualTo(0)) continue;

    if (application.sourceType === 'CUSTOMER_MONEY_RECEIPT') {
      const receipt = await client.customerReceipt.findFirst({
        where: { id: application.sourceId, branchId, customerId },
        select: { id: true, allocatedAmount: true },
      });
      if (!receipt || money(receipt.allocatedAmount).lessThan(amount)) {
        throw buildError('ไม่สามารถคืนยอดกลับไปยังใบรับเงินต้นทางได้', 409, 'CUSTOMER_MONEY_SOURCE_RESTORE_CONFLICT');
      }
      await client.customerReceipt.update({
        where: { id: receipt.id },
        data: {
          allocatedAmount: { decrement: amount },
          remainingAmount: { increment: amount },
        },
      });
    } else if (application.sourceType === 'CUSTOMER_DEPOSIT') {
      const deposit = await client.customerDeposit.findFirst({
        where: { id: application.sourceId, branchId, customerId },
        select: { id: true, usedAmount: true },
      });
      if (!deposit || money(deposit.usedAmount).lessThan(amount)) {
        throw buildError('ไม่สามารถคืนยอดกลับไปยังเงินมัดจำต้นทางได้', 409, 'CUSTOMER_MONEY_SOURCE_RESTORE_CONFLICT');
      }
      await client.customerDeposit.update({
        where: { id: deposit.id },
        data: {
          usedAmount: { decrement: amount },
          status: 'ACTIVE',
        },
      });
    } else if (application.sourceType === 'CUSTOMER_MONEY_BALANCE') {
      // Legacy settlement rows created before source-level allocation did not mutate source projections.
      // Recomputing CustomerMoneyBalance from the source projections is therefore the correct reversal.
    } else {
      throw buildError('ไม่สามารถคืนยอด Customer Money จากแหล่งต้นทางประเภทนี้ได้', 409, 'CUSTOMER_MONEY_SOURCE_RESTORE_UNSUPPORTED');
    }
  }
};

module.exports = {
  money,
  listAvailableCustomerMoneySources,
  calculateAvailableCustomerMoney,
  consumeCustomerMoneySources,
  restoreCustomerMoneySources,
};
