'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('../../../../lib/prisma');
const { receiveCustomerMoney } = require('./receiveCustomerMoneyService');

const D = (value) => new Prisma.Decimal(String(value));

test('receive customer money writes receipt, ledger and combined balance in one transaction client', async () => {
  const tx = {
    customerProfile: {
      findFirst: async () => ({ id: 11 }),
    },
    employeeProfile: {
      findFirst: async () => ({ id: 22 }),
    },
    customerReceipt: {
      count: async () => 0,
      findMany: async () => [
        { remainingAmount: D(30) },
        { remainingAmount: D(50) },
      ],
    },
    customerDeposit: {
      findMany: async () => [
        { totalAmount: D(100), usedAmount: D(20) },
      ],
    },
  };

  const prisma = {
    $transaction: async (callback) => callback(tx),
  };

  const calls = {
    receipt: null,
    ledger: null,
    balance: null,
  };

  const result = await receiveCustomerMoney({
    prisma,
    receiptRepository: async (args) => {
      calls.receipt = args;
      return {
        id: 77,
        code: args.data.code,
        branchId: args.data.branchId,
        customerId: args.data.customerId,
        receivedAt: args.data.receivedAt,
        totalAmount: args.data.totalAmount,
        remainingAmount: args.data.remainingAmount,
        paymentMethod: args.data.paymentMethod,
        referenceNo: args.data.referenceNo,
        note: args.data.note,
        status: args.data.status,
        createdByEmployeeProfileId: args.data.createdByEmployeeProfileId,
        createdAt: new Date('2026-08-09T03:00:00.000Z'),
        updatedAt: new Date('2026-08-09T03:00:00.000Z'),
        customer: { id: 11, name: 'Customer A' },
      };
    },
    createLedger: async (args) => {
      calls.ledger = args;
      return { id: 88 };
    },
    updateBalance: async (args) => {
      calls.balance = args;
      return {
        customerId: args.customerId,
        availableAmount: args.availableAmount,
      };
    },
    input: {
      customerId: 11,
      amount: 50,
      paymentMethod: 'CASH',
      description: 'รับเงินมัดจำ',
      receivedAt: '2026-08-09T10:00:00+07:00',
    },
    user: {
      branchId: 2,
      employeeId: 22,
    },
  });

  assert.equal(calls.receipt.client, tx);
  assert.equal(calls.ledger.client, tx);
  assert.equal(calls.balance.client, tx);

  assert.match(calls.receipt.data.code, /^CMR-\d{6}-0001$/);
  assert.equal(calls.ledger.data.eventType, 'MONEY_RECEIVED');
  assert.equal(calls.ledger.data.direction, 'CREDIT');
  assert.equal(calls.ledger.data.referenceType, 'CUSTOMER_MONEY_RECEIPT');
  assert.equal(calls.ledger.data.referenceId, 77);

  assert.equal(Number(calls.balance.availableAmount), 160);
  assert.equal(result.receipt.id, 77);
  assert.equal(result.balance.availableAmount, 160);
});
