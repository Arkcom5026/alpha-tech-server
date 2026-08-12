'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('../../../../../lib/prisma');
const repository = require('./customerDepositRuntimeRepository');

const D = (value) => new Prisma.Decimal(String(value));

const makeClient = () => {
  const writes = [];
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
      findUnique: async () => ({
        id: 20,
        branchId: 2,
        customerId: 3,
        usedAmount: D(0),
      }),
      findMany: async () => [{
        id: 20,
        totalAmount: D(100),
        usedAmount: D(0),
        createdAt: new Date('2026-08-02T03:00:00Z'),
      }],
      update: async (args) => {
        writes.push(args);
        return { id: 20, ...args.data };
      },
    },
    customerMoneySettlementLine: {
      aggregate: async () => ({ _sum: { appliedAmount: D(80) } }),
    },
  };
  return { client, writes };
};

test('direct deposit update rejects spending beyond source amount left after legacy reservation', async () => {
  const { client, writes } = makeClient();

  await assert.rejects(
    repository.updateDepositById({
      id: 20,
      data: { usedAmount: D(90) },
      client,
    }),
    (error) => error?.code === 'DEPOSIT_CUSTOMER_MONEY_RESERVED' && error?.statusCode === 409,
  );

  assert.equal(writes.length, 0);
});

test('direct deposit update permits spending within source amount left after legacy reservation', async () => {
  const { client, writes } = makeClient();

  const updated = await repository.updateDepositById({
    id: 20,
    data: { usedAmount: D(80) },
    client,
  });

  assert.equal(writes.length, 1);
  assert.equal(Number(updated.usedAmount), 80);
});
