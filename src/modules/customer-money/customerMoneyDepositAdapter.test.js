'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('../../../lib/prisma');
const {
  createCustomerMoneyApplication,
} = require('./application/createCustomerMoneyApplicationService');
const {
  createCustomerMoneyLedger,
} = require('./ledger/createCustomerMoneyLedgerService');
const {
  updateCustomerMoneyBalance,
} = require('./balance/updateCustomerMoneyBalanceService');

test('Customer Money services write through the provided transaction client', async () => {
  const calls = [];
  const client = {
    customerMoneyApplication: { create: async (args) => (calls.push(['application', args]), { id: 1 }) },
    customerMoneyLedger: { create: async (args) => (calls.push(['ledger', args]), { id: 2 }) },
    customerMoneyBalance: { upsert: async (args) => (calls.push(['balance', args]), { id: 3 }) },
  };
  await createCustomerMoneyApplication({ client, data: { sourceType: 'CUSTOMER_DEPOSIT' } });
  await createCustomerMoneyLedger({ client, data: { eventType: 'MONEY_APPLIED' } });
  await updateCustomerMoneyBalance({
    client, branchId: 2, customerId: 3, availableAmount: new Prisma.Decimal(75),
  });
  assert.deepEqual(calls.map(([name]) => name), ['application', 'ledger', 'balance']);
  assert.deepEqual(calls[2][1].where, { branchId_customerId: { branchId: 2, customerId: 3 } });
});

test('deposit use adapts the existing FE payload into the Customer Money foundation atomically', async () => {
  const order = [];
  const tx = {};
  const repositoryPath = require.resolve('../finance/customer-deposit/runtime/customerDepositRuntimeRepository');
  const applicationPath = require.resolve('./application/createCustomerMoneyApplicationService');
  const ledgerPath = require.resolve('./ledger/createCustomerMoneyLedgerService');
  const balancePath = require.resolve('./balance/updateCustomerMoneyBalanceService');
  const runtimePath = require.resolve('../finance/customer-deposit/runtime/customerDepositRuntimeService');

  require.cache[repositoryPath] = { exports: {
    runTransaction: (callback) => callback(tx),
    findActiveDepositByIdAndBranch: async (input) => {
      assert.equal(input.client, tx);
      return {
        id: 7, branchId: 2, customerId: 3, status: 'ACTIVE',
        totalAmount: new Prisma.Decimal(100), usedAmount: new Prisma.Decimal(20),
      };
    },
    updateDepositById: async (input) => {
      assert.equal(input.client, tx);
      order.push('deposit');
      return { id: 7, totalAmount: new Prisma.Decimal(100), usedAmount: input.data.usedAmount };
    },
    findActiveDepositBalancesByCustomer: async (input) => {
      assert.equal(input.client, tx);
      return [
        { totalAmount: new Prisma.Decimal(100), usedAmount: new Prisma.Decimal(45) },
        { totalAmount: new Prisma.Decimal(50), usedAmount: new Prisma.Decimal(5) },
      ];
    },
    findActiveMoneyReceiptBalancesByCustomer: async (input) => {
      assert.equal(input.client, tx);
      return [];
    },
  } };
  require.cache[applicationPath] = { exports: {
    createCustomerMoneyApplication: async ({ client, data }) => {
      assert.equal(client, tx);
      order.push('application');
      assert.deepEqual({
        sourceType: data.sourceType, sourceId: data.sourceId,
        targetType: data.targetType, targetId: data.targetId,
      }, {
        sourceType: 'CUSTOMER_DEPOSIT', sourceId: 7, targetType: 'SALE', targetId: 11,
      });
      return { id: 13 };
    },
  } };
  require.cache[ledgerPath] = { exports: {
    createCustomerMoneyLedger: async ({ client, data }) => {
      assert.equal(client, tx);
      order.push('ledger');
      assert.equal(data.applicationId, 13);
      assert.equal(data.eventType, 'MONEY_APPLIED');
      assert.equal(data.direction, 'DEBIT');
    },
  } };
  require.cache[balancePath] = { exports: {
    updateCustomerMoneyBalance: async ({ client, branchId, customerId, availableAmount }) => {
      assert.equal(client, tx);
      order.push('balance');
      assert.equal(branchId, 2);
      assert.equal(customerId, 3);
      assert.equal(availableAmount.toString(), '100');
    },
  } };
  delete require.cache[runtimePath];
  const runtime = require(runtimePath);
  const result = await runtime.useCustomerDeposit({
    body: { depositId: 7, saleId: 11, amountUsed: 25 },
    user: { branchId: 2, employeeId: 5 },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.deposit.usedAmount, 45);
  assert.deepEqual(order, ['deposit', 'application', 'ledger', 'balance']);
});
