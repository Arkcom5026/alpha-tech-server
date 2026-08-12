'use strict';

const { Prisma } = require('../../../../lib/prisma');
const { resolveFinancialCustomerGroup } = require('../../customer/financial-group/customerFinancialGroupResolver');

const money = (value) => new Prisma.Decimal(String(value ?? 0));

const buildError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const getResolvedFinancialGroup = async (client, { branchId, customerId, financialGroup = null }) => {
  const ownerId = Number(financialGroup?.ownerId);
  const memberIds = Array.isArray(financialGroup?.memberIds)
    ? financialGroup.memberIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
    : [];
  if (Number.isInteger(ownerId) && ownerId > 0 && memberIds.length > 0 && memberIds.includes(ownerId)) {
    return { ...financialGroup, ownerId, memberIds };
  }
  return resolveFinancialCustomerGroup(client, { branchId, customerId });
};

const sourceTimestamp = (value) => {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const listAvailableCustomerMoneySources = async (client, {
  branchId,
  customerId,
  financialGroup = null,
}) => {
  const group = await getResolvedFinancialGroup(client, { branchId, customerId, financialGroup });
  const [receipts, deposits] = await Promise.all([
    client.customerReceipt.findMany({
      where: {
        branchId,
        customerId: { in: group.memberIds },
        status: 'ACTIVE',
        code: { startsWith: 'CMR-' },
        remainingAmount: { gt: 0 },
      },
      select: {
        id: true,
        customerId: true,
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
        customerId: { in: group.memberIds },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        customerId: true,
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

const getLegacyBalanceReservation = async (client, {
  branchId,
  customerId,
  financialGroup = null,
}) => {
  if (!client?.customerMoneySettlementLine?.aggregate) return money(0);
  const group = await getResolvedFinancialGroup(client, { branchId, customerId, financialGroup });
  const aggregate = await client.customerMoneySettlementLine.aggregate({
    where: {
      settlement: {
        branchId,
        customerId: group.ownerId,
        status: 'ACTIVE',
        settlementType: 'DELIVERY_CREDIT',
      },
      application: {
        sourceType: 'CUSTOMER_MONEY_BALANCE',
        status: 'APPLIED',
      },
    },
    _sum: { appliedAmount: true },
  });
  return money(aggregate?._sum?.appliedAmount);
};

const buildSpendableSourceState = async (client, context) => {
  const financialGroup = await getResolvedFinancialGroup(client, context);
  const resolvedContext = { ...context, financialGroup };
  const sources = await listAvailableCustomerMoneySources(client, resolvedContext);
  const legacyReservedAmount = await getLegacyBalanceReservation(client, resolvedContext);
  let reservationRemaining = legacyReservedAmount;

  const sourceStates = sources.map((source) => {
    const reservedHere = Prisma.Decimal.min(source.availableAmount, reservationRemaining);
    reservationRemaining = reservationRemaining.minus(reservedHere);
    return {
      ...source,
      sourceAvailableAmount: source.availableAmount,
      availableAmount: source.availableAmount.minus(reservedHere),
      legacyReservedAmount: reservedHere,
    };
  });
  const spendableSources = sourceStates.filter((source) => source.availableAmount.greaterThan(0));

  const sourceTotal = sources.reduce((sum, source) => sum.plus(source.availableAmount), money(0));
  const availableAmount = spendableSources.reduce((sum, source) => sum.plus(source.availableAmount), money(0));
  return {
    financialGroup,
    sources: spendableSources,
    sourceStates,
    sourceTotal,
    legacyReservedAmount,
    uncoveredLegacyReservation: Prisma.Decimal.max(reservationRemaining, money(0)),
    availableAmount,
  };
};

const getCustomerMoneySourceState = async (client, {
  branchId,
  customerId,
  sourceType,
  sourceId,
  financialGroup = null,
}) => {
  const state = await buildSpendableSourceState(client, { branchId, customerId, financialGroup });
  const source = state.sourceStates.find((candidate) => (
    candidate.sourceType === sourceType && Number(candidate.sourceId) === Number(sourceId)
  ));
  return {
    source: source || null,
    availableAmount: money(source?.availableAmount),
    sourceAvailableAmount: money(source?.sourceAvailableAmount),
    legacyReservedAmount: money(source?.legacyReservedAmount),
    uncoveredLegacyReservation: state.uncoveredLegacyReservation,
  };
};

const calculateAvailableCustomerMoney = async (client, context) => {
  const state = await buildSpendableSourceState(client, context);
  return state.availableAmount;
};

const consumeCustomerMoneySources = async (client, {
  branchId,
  customerId,
  amount,
  financialGroup = null,
}) => {
  const requested = money(amount);
  if (requested.lessThanOrEqualTo(0)) return [];

  const state = await buildSpendableSourceState(client, { branchId, customerId, financialGroup });
  const sources = state.sources;
  if (state.uncoveredLegacyReservation.greaterThan(0)) {
    throw buildError('ข้อมูล Customer Money เดิมไม่สมดุลกับยอดต้นทาง กรุณาตรวจสอบก่อนตัดยอด', 409, 'CUSTOMER_MONEY_SOURCE_PROJECTION_CONFLICT');
  }
  if (requested.greaterThan(state.availableAmount)) {
    throw buildError('ยอด Customer Money พร้อมใช้ไม่เพียงพอ', 409, 'INSUFFICIENT_CUSTOMER_MONEY');
  }

  const chunks = [];
  let remaining = requested;

  for (const source of sources) {
    if (remaining.lessThanOrEqualTo(0)) break;
    const chunkAmount = Prisma.Decimal.min(source.availableAmount, remaining);
    if (chunkAmount.lessThanOrEqualTo(0)) continue;

    if (source.sourceType === 'CUSTOMER_MONEY_RECEIPT') {
      const actualRemaining = money(source.snapshot.remainingAmount);
      const fullyConsumed = chunkAmount.greaterThanOrEqualTo(actualRemaining);
      const updated = await client.customerReceipt.updateMany({
        where: {
          id: source.sourceId,
          branchId,
          customerId: source.snapshot.customerId,
          status: 'ACTIVE',
          remainingAmount: source.snapshot.remainingAmount,
        },
        data: {
          allocatedAmount: { increment: chunkAmount },
          remainingAmount: { decrement: chunkAmount },
          ...(fullyConsumed ? { status: 'FULLY_ALLOCATED' } : {}),
        },
      });
      if (updated.count !== 1) {
        throw buildError('ยอดใบรับเงินมีการเปลี่ยนแปลงจากรายการอื่น กรุณาลองใหม่', 409, 'CUSTOMER_MONEY_SOURCE_CONFLICT');
      }
    } else if (source.sourceType === 'CUSTOMER_DEPOSIT') {
      const actualRemaining = money(source.snapshot.totalAmount).minus(money(source.snapshot.usedAmount));
      const fullyConsumed = chunkAmount.greaterThanOrEqualTo(actualRemaining);
      const updated = await client.customerDeposit.updateMany({
        where: {
          id: source.sourceId,
          branchId,
          customerId: source.snapshot.customerId,
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

const restoreCustomerMoneySources = async (client, {
  branchId,
  customerId,
  applications,
  financialGroup = null,
}) => {
  const group = await getResolvedFinancialGroup(client, { branchId, customerId, financialGroup });
  for (const application of applications || []) {
    const amount = money(application.amount);
    if (amount.lessThanOrEqualTo(0)) continue;

    if (application.sourceType === 'CUSTOMER_MONEY_RECEIPT') {
      const receipt = await client.customerReceipt.findFirst({
        where: { id: application.sourceId, branchId, customerId: { in: group.memberIds } },
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
          status: 'ACTIVE',
        },
      });
    } else if (application.sourceType === 'CUSTOMER_DEPOSIT') {
      const deposit = await client.customerDeposit.findFirst({
        where: { id: application.sourceId, branchId, customerId: { in: group.memberIds } },
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
      // Legacy settlement rows did not mutate source projections. Once the settlement is cancelled,
      // getLegacyBalanceReservation stops reserving this amount and the source projection becomes available again.
    } else {
      throw buildError('ไม่สามารถคืนยอด Customer Money จากแหล่งต้นทางประเภทนี้ได้', 409, 'CUSTOMER_MONEY_SOURCE_RESTORE_UNSUPPORTED');
    }
  }
};

module.exports = {
  money,
  getResolvedFinancialGroup,
  listAvailableCustomerMoneySources,
  getLegacyBalanceReservation,
  buildSpendableSourceState,
  getCustomerMoneySourceState,
  calculateAvailableCustomerMoney,
  consumeCustomerMoneySources,
  restoreCustomerMoneySources,
};
