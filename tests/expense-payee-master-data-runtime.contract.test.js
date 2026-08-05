'use strict';

const assert = require('node:assert/strict');

const {
  ListExpensePayeesRepository,
} = require('../src/modules/tax-expense/expense-payee/query/list/listExpensePayeesSlice');
const {
  CreateExpensePayeeRepository,
  CreateExpensePayeeController,
} = require('../src/modules/tax-expense/expense-payee/create/createExpensePayeeSlice');

(async () => {
  const listCalls = [];
  const listRepository = new ListExpensePayeesRepository({
    expensePayee: {
      findMany: async (options) => {
        listCalls.push(options);
        return [];
      },
    },
  });

  await listRepository.findMany(7, 'tax office');
  assert.equal(listCalls.length, 1);
  assert.deepEqual(listCalls[0].where.branchId, 7);
  assert.equal(listCalls[0].where.active, true);
  assert.equal(listCalls[0].where.OR.length, 4);

  const createCalls = [];
  const createRepository = new CreateExpensePayeeRepository({
    expensePayee: {
      create: async (options) => {
        createCalls.push(options);
        return { id: 101, ...options.data };
      },
    },
  });

  const controller = new CreateExpensePayeeController(createRepository);
  const req = {
    user: { branchId: 7, employeeId: 35 },
    body: {
      branchId: 999,
      createdByEmployeeId: 999,
      payeeType: 'government',
      name: 'สำนักงานตัวอย่าง',
      taxId: '1234567890123',
      taxBranchCode: '00000',
      phone: '021234567',
    },
  };
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return payload; },
  };

  await controller.handle(req, response);

  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.ok, true);
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0].data.branchId, 7);
  assert.equal(createCalls[0].data.createdByEmployeeId, 35);
  assert.equal(createCalls[0].data.payeeType, 'GOVERNMENT');
  assert.equal(Object.hasOwn(createCalls[0].data, 'supplierId'), false);

  console.log('Expense payee master data runtime contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
