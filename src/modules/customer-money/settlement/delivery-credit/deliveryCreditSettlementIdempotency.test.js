'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('../../../../../lib/prisma');
const {
  buildSettlementRequestHash,
  createDeliveryCreditSettlement,
} = require('./createDeliveryCreditSettlementService');

const D = (value) => new Prisma.Decimal(String(value));

const command = {
  branchId: 2,
  customerId: 7,
  createdById: 9,
  commandKey: 'cms-retry-001',
  note: 'retry-safe',
  lines: [{ saleId: 11, saleItemId: 101, lineType: 'STOCK', amount: 100 }],
};

const presentationBranch = {
  id: command.branchId,
  name: 'Branch A',
  address: 'Bangkok',
  phone: '020000000',
  taxId: '0100000000000',
  branchCode: '00000',
  isHeadOffice: true,
  slug: 'branch-a',
  documentHeaderConfig: null,
};

const presentationSnapshotRepository = () => ({
  findUnique: async () => null,
  upsert: async ({ create }) => ({ id: 1, ...create }),
});

test('same idempotency key and same request replays the existing settlement without creating another one', async () => {
  const requestHash = buildSettlementRequestHash(command);
  let createCount = 0;
  const tx = {
    $queryRaw: async () => [],
    branch: { findFirst: async () => presentationBranch },
    documentPresentationSnapshot: presentationSnapshotRepository(),
    customerMoneySettlementCommand: {
      findUnique: async () => ({
        customerId: command.customerId,
        requestHash,
        settlementId: 55,
      }),
    },
    customerMoneySettlement: {
      findFirst: async () => ({
        id: 55,
        code: 'CMS-260812-0001',
        branchId: command.branchId,
        customerId: command.customerId,
        settlementType: 'DELIVERY_CREDIT',
        totalAmount: D(100),
        status: 'ACTIVE',
        settledAt: new Date('2026-08-12T00:30:00Z'),
        customer: { id: 7, name: 'Customer A' },
        lines: [],
      }),
      create: async () => { createCount += 1; throw new Error('must not create on replay'); },
    },
    customerReceipt: { findMany: async () => [] },
    customerDeposit: { findMany: async () => [] },
    customerMoneySettlementLine: {
      aggregate: async () => ({ _sum: { appliedAmount: null } }),
    },
  };
  const prisma = { $transaction: async (callback) => callback(tx) };

  const result = await createDeliveryCreditSettlement({ prisma, command });

  assert.equal(result.id, 55);
  assert.equal(result.idempotentReplay, true);
  assert.equal(result.customerMoneyBalance, 0);
  assert.ok(result.presentationSnapshots);
  assert.equal(createCount, 0);
});

test('same idempotency key with a different request fails closed', async () => {
  const tx = {
    $queryRaw: async () => [],
    customerMoneySettlementCommand: {
      findUnique: async () => ({
        customerId: command.customerId,
        requestHash: 'different-request-hash',
        settlementId: 55,
      }),
    },
  };
  const prisma = { $transaction: async (callback) => callback(tx) };

  await assert.rejects(
    () => createDeliveryCreditSettlement({ prisma, command }),
    (error) => error?.code === 'IDEMPOTENCY_KEY_REUSED' && error?.statusCode === 409,
  );
});