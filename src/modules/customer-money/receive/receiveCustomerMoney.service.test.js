'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('../../../../lib/prisma');
const {
  receiveCustomerMoney,
  cancelCustomerMoneyReceive,
} = require('./receiveCustomerMoneyService');

const D = (value) => new Prisma.Decimal(String(value));

test('receive customer money writes receipt, ledger and combined balance in one transaction client', async () => {
  const tx = {
    customerProfile: { findFirst: async () => ({ id: 11 }) },
    employeeProfile: { findFirst: async () => ({ id: 22 }) },
    customerReceipt: {
      count: async () => 0,
      findMany: async () => [{ remainingAmount: D(30), allocatedAmount: D(0), receivedAt: new Date('2026-08-08T03:00:00Z'), createdAt: new Date('2026-08-08T03:00:00Z') }, { remainingAmount: D(50), allocatedAmount: D(0), receivedAt: new Date('2026-08-09T03:00:00Z'), createdAt: new Date('2026-08-09T03:00:00Z') }],
    },
    customerDeposit: {
      findMany: async () => [{ totalAmount: D(100), usedAmount: D(20), id: 1, createdAt: new Date('2026-08-07T03:00:00Z') }],
    },
  };
  const prisma = { $transaction: async (callback) => callback(tx) };
  const calls = { receipt: null, ledger: null, balance: null };

  const result = await receiveCustomerMoney({
    prisma,
    receiptRepository: async (args) => {
      calls.receipt = args;
      return {
        id: 77, code: args.data.code, branchId: args.data.branchId,
        customerId: args.data.customerId, receivedAt: args.data.receivedAt,
        totalAmount: args.data.totalAmount, allocatedAmount: args.data.allocatedAmount,
        remainingAmount: args.data.remainingAmount, paymentMethod: args.data.paymentMethod,
        referenceNo: args.data.referenceNo, note: args.data.note, status: args.data.status,
        createdByEmployeeProfileId: args.data.createdByEmployeeProfileId,
        createdAt: new Date('2026-08-09T03:00:00.000Z'),
        updatedAt: new Date('2026-08-09T03:00:00.000Z'),
        customer: { id: 11, name: 'Customer A' },
      };
    },
    createLedger: async (args) => { calls.ledger = args; return { id: 88 }; },
    updateBalance: async (args) => {
      calls.balance = args;
      return { customerId: args.customerId, availableAmount: args.availableAmount };
    },
    input: {
      customerId: 11,
      amount: 50,
      paymentMethod: 'CASH',
      description: 'รับเงินมัดจำ',
      receivedAt: '2026-08-09T10:00:00+07:00',
    },
    user: { branchId: 2, employeeId: 22 },
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

test('cancel customer money receive rechecks under shared customer lock and recomputes balance atomically', async () => {
  const receipt = {
    id: 77,
    code: 'CMR-260809-0001',
    branchId: 2,
    customerId: 11,
    receivedAt: new Date('2026-08-09T03:00:00.000Z'),
    totalAmount: D(50),
    allocatedAmount: D(0),
    remainingAmount: D(50),
    paymentMethod: 'CASH',
    referenceNo: null,
    note: 'รับเงินมัดจำ',
    status: 'ACTIVE',
    createdByEmployeeProfileId: 22,
    createdAt: new Date('2026-08-09T03:00:00.000Z'),
    updatedAt: new Date('2026-08-09T03:00:00.000Z'),
    customer: { id: 11, name: 'Customer A' },
  };
  const calls = { update: null, ledger: null, balance: null };
  const tx = {
    employeeProfile: { findFirst: async () => ({ id: 22 }) },
    customerReceipt: {
      update: async (args) => { calls.update = args; return args; },
      findMany: async () => [{
        id: 80,
        remainingAmount: D(20),
        allocatedAmount: D(0),
        receivedAt: new Date('2026-08-10T03:00:00Z'),
        createdAt: new Date('2026-08-10T03:00:00Z'),
      }],
    },
    customerDeposit: {
      findMany: async () => [{
        id: 1,
        totalAmount: D(100),
        usedAmount: D(40),
        createdAt: new Date('2026-08-08T03:00:00Z'),
      }],
    },
  };
  const prisma = { $transaction: async (callback) => callback(tx) };
  let readCount = 0;

  const result = await cancelCustomerMoneyReceive({
    prisma,
    getRepository: async ({ client }) => {
      assert.equal(client, tx);
      readCount += 1;
      if (readCount <= 2) return receipt;
      return {
        ...receipt,
        status: 'CANCELLED',
        remainingAmount: D(0),
        cancelledByEmployeeProfileId: 22,
        cancelledAt: new Date('2026-08-09T04:00:00.000Z'),
        cancelReason: 'ลูกค้าขอคืนเงิน',
      };
    },
    createLedger: async (args) => { calls.ledger = args; return { id: 99 }; },
    updateBalance: async (args) => {
      calls.balance = args;
      return { customerId: args.customerId, availableAmount: args.availableAmount };
    },
    user: { branchId: 2, employeeId: 22 },
    id: 77,
    cancelReason: 'ลูกค้าขอคืนเงิน',
  });

  assert.equal(readCount, 3);
  assert.equal(calls.update.data.status, 'CANCELLED');
  assert.equal(Number(calls.update.data.remainingAmount), 0);
  assert.equal(calls.update.data.cancelledByEmployeeProfileId, 22);
  assert.equal(calls.update.data.cancelReason, 'ลูกค้าขอคืนเงิน');
  assert.equal(calls.ledger.client, tx);
  assert.equal(calls.ledger.data.eventType, 'MONEY_RECEIVE_CANCELLED');
  assert.equal(calls.ledger.data.direction, 'DEBIT');
  assert.equal(Number(calls.ledger.data.amount), 50);
  assert.equal(calls.balance.client, tx);
  assert.equal(Number(calls.balance.availableAmount), 80);
  assert.equal(result.receipt.status, 'CANCELLED');
  assert.equal(result.balance.availableAmount, 80);
});