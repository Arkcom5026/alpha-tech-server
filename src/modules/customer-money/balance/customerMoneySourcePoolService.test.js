'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('../../../../lib/prisma');
const {
  calculateAvailableCustomerMoney,
  consumeCustomerMoneySources,
  getCustomerMoneySourceState,
  restoreCustomerMoneySources,
} = require('./customerMoneySourcePoolService');

const D = (value) => new Prisma.Decimal(String(value));

test('customer money source pool consumes oldest receipt then deposit and preserves exact source trace', async () => {
  const updates = [];
  const client = {
    customerReceipt: {
      findMany: async () => [{
        id: 10,
        remainingAmount: D(60),
        allocatedAmount: D(20),
        receivedAt: new Date('2026-08-01T03:00:00Z'),
        createdAt: new Date('2026-08-01T03:00:00Z'),
      }],
      updateMany: async (args) => { updates.push(['receipt', args]); return { count: 1 }; },
    },
    customerDeposit: {
      findMany: async () => [{
        id: 20,
        totalAmount: D(100),
        usedAmount: D(40),
        createdAt: new Date('2026-08-02T03:00:00Z'),
      }],
      updateMany: async (args) => { updates.push(['deposit', args]); return { count: 1 }; },
    },
  };

  const available = await calculateAvailableCustomerMoney(client, { branchId: 2, customerId: 3 });
  assert.equal(available.toString(), '120');

  const chunks = await consumeCustomerMoneySources(client, {
    branchId: 2,
    customerId: 3,
    amount: D(90),
  });

  assert.deepEqual(chunks.map((chunk) => ({
    sourceType: chunk.sourceType,
    sourceId: chunk.sourceId,
    amount: chunk.amount.toString(),
  })), [
    { sourceType: 'CUSTOMER_MONEY_RECEIPT', sourceId: 10, amount: '60' },
    { sourceType: 'CUSTOMER_DEPOSIT', sourceId: 20, amount: '30' },
  ]);
  assert.equal(updates[0][0], 'receipt');
  assert.equal(updates[0][1].data.allocatedAmount.increment.toString(), '60');
  assert.equal(updates[0][1].data.remainingAmount.decrement.toString(), '60');
  assert.equal(updates[0][1].data.status, 'FULLY_ALLOCATED');
  assert.equal(updates[1][0], 'deposit');
  assert.equal(updates[1][1].data.usedAmount.increment.toString(), '30');
});

test('legacy balance settlements reserve oldest source money and expose source-specific spendable amount', async () => {
  const client = {
    customerReceipt: {
      findMany: async () => [{
        id: 10,
        remainingAmount: D(60),
        allocatedAmount: D(0),
        receivedAt: new Date('2026-08-01T03:00:00Z'),
        createdAt: new Date('2026-08-01T03:00:00Z'),
      }],
    },
    customerDeposit: {
      findMany: async () => [{
        id: 20,
        totalAmount: D(100),
        usedAmount: D(0),
        createdAt: new Date('2026-08-02T03:00:00Z'),
      }],
    },
    customerMoneySettlementLine: {
      aggregate: async () => ({ _sum: { appliedAmount: D(80) } }),
    },
  };

  const available = await calculateAvailableCustomerMoney(client, { branchId: 2, customerId: 3 });
  assert.equal(available.toString(), '80');

  const receiptState = await getCustomerMoneySourceState(client, {
    branchId: 2,
    customerId: 3,
    sourceType: 'CUSTOMER_MONEY_RECEIPT',
    sourceId: 10,
  });
  assert.equal(receiptState.legacyReservedAmount.toString(), '60');
  assert.equal(receiptState.availableAmount.toString(), '0');

  const depositState = await getCustomerMoneySourceState(client, {
    branchId: 2,
    customerId: 3,
    sourceType: 'CUSTOMER_DEPOSIT',
    sourceId: 20,
  });
  assert.equal(depositState.legacyReservedAmount.toString(), '20');
  assert.equal(depositState.availableAmount.toString(), '80');
  assert.equal(depositState.uncoveredLegacyReservation.toString(), '0');
});

test('customer money source pool restores traced receipt and deposit applications', async () => {
  const updates = [];
  const client = {
    customerReceipt: {
      findFirst: async () => ({ id: 10, allocatedAmount: D(50) }),
      update: async (args) => { updates.push(['receipt', args]); return args; },
    },
    customerDeposit: {
      findFirst: async () => ({ id: 20, usedAmount: D(40) }),
      update: async (args) => { updates.push(['deposit', args]); return args; },
    },
  };

  await restoreCustomerMoneySources(client, {
    branchId: 2,
    customerId: 3,
    applications: [
      { sourceType: 'CUSTOMER_MONEY_RECEIPT', sourceId: 10, amount: D(25) },
      { sourceType: 'CUSTOMER_DEPOSIT', sourceId: 20, amount: D(15) },
    ],
  });

  assert.equal(updates[0][0], 'receipt');
  assert.equal(updates[0][1].data.allocatedAmount.decrement.toString(), '25');
  assert.equal(updates[0][1].data.remainingAmount.increment.toString(), '25');
  assert.equal(updates[0][1].data.status, 'ACTIVE');
  assert.equal(updates[1][0], 'deposit');
  assert.equal(updates[1][1].data.usedAmount.decrement.toString(), '15');
  assert.equal(updates[1][1].data.status, 'ACTIVE');
});