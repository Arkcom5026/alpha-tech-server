'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('../../../../../lib/prisma');
const { projectSalePaymentStatus } = require('./salePaymentPostingService');

const D = (value) => new Prisma.Decimal(String(value));

test('sale payment projection combines regular payments and active customer money settlements', async () => {
  let updateArgs = null;
  const tx = {
    $queryRaw: async () => [{ pg_advisory_xact_lock: null }],
    sale: {
      findUnique: async () => ({ totalAmount: D(1000), status: 'FINALIZED' }),
      update: async (args) => { updateArgs = args; return args; },
    },
    paymentItem: {
      aggregate: async () => ({ _sum: { amount: D(400) } }),
    },
    customerMoneySettlementLine: {
      aggregate: async (args) => {
        assert.equal(args.where.saleId, 11);
        assert.deepEqual(args.where.settlement, { status: 'ACTIVE', settlementType: 'DELIVERY_CREDIT' });
        return { _sum: { appliedAmount: D(600) } };
      },
    },
    payment: {
      findFirst: async () => ({ receivedAt: new Date('2026-08-10T03:00:00.000Z') }),
    },
    customerMoneySettlement: {
      findFirst: async () => ({ settledAt: new Date('2026-08-11T03:00:00.000Z') }),
    },
  };

  const result = await projectSalePaymentStatus(tx, 11);

  assert.equal(result.paid, true);
  assert.equal(result.statusPayment, 'PAID');
  assert.equal(result.paidAmount.toString(), '1000');
  assert.equal(result.paidAt.toISOString(), '2026-08-11T03:00:00.000Z');
  assert.equal(updateArgs.data.paid, true);
  assert.equal(updateArgs.data.statusPayment, 'PAID');
  assert.equal(updateArgs.data.paidAmount.toString(), '1000');
});

test('sale payment projection remains compatible when settlement delegates are unavailable', async () => {
  let updateArgs = null;
  const tx = {
    sale: {
      findUnique: async () => ({ totalAmount: D(1000), status: 'FINALIZED' }),
      update: async (args) => { updateArgs = args; return args; },
    },
    paymentItem: {
      aggregate: async () => ({ _sum: { amount: D(250) } }),
    },
    payment: {
      findFirst: async () => null,
    },
  };

  const result = await projectSalePaymentStatus(tx, 11);

  assert.equal(result.paid, false);
  assert.equal(result.statusPayment, 'PARTIALLY_PAID');
  assert.equal(result.paidAmount.toString(), '250');
  assert.equal(updateArgs.data.statusPayment, 'PARTIALLY_PAID');
});