const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createCombinedBillingDocumentService,
  normalizeSaleIds,
} = require('./createCombinedBillingDocumentService');
const {
  createCombinedBillingDocumentRepository,
} = require('./createCombinedBillingDocumentRepository');

test('service validates branch, employee and sale identities before repository access', async () => {
  let calls = 0;
  const service = createCombinedBillingDocumentService({
    repository: { create: async () => { calls += 1; } },
  });

  await assert.rejects(
    service.create({ employeeId: 2, saleIds: [1] }),
    (error) => error.statusCode === 401 && error.code === 'BRANCH_CONTEXT_REQUIRED',
  );
  await assert.rejects(
    service.create({ branchId: 1, saleIds: [1] }),
    (error) => error.statusCode === 403 && error.code === 'EMPLOYEE_CONTEXT_REQUIRED',
  );
  await assert.rejects(
    service.create({ branchId: 1, employeeId: 2, saleIds: [] }),
    (error) => error.statusCode === 400,
  );
  assert.equal(calls, 0);
});

test('service normalizes sale ids and preserves the create payload', async () => {
  let payload;
  const service = createCombinedBillingDocumentService({
    repository: { create: async (input) => { payload = input; return { id: 9 }; } },
  });

  const result = await service.create({
    branchId: '1',
    employeeId: '2',
    saleIds: ['10', 11, 'bad', 0],
    note: 123,
  });

  assert.deepEqual(result, { id: 9 });
  assert.deepEqual(payload, {
    branchId: 1,
    employeeId: 2,
    saleIds: [10, 11],
    note: '123',
  });
  assert.deepEqual(normalizeSaleIds(['1', 'bad', 2]), [1, 2]);
});

test('repository preserves branch-safe eligibility and atomic write order', async () => {
  const calls = [];
  const decimal = (value) => ({
    value: Number(value),
    plus(other) { return decimal(this.value + Number(other.value ?? other)); },
  });

  const tx = {
    sale: {
      findMany: async (query) => {
        calls.push(['findMany', query]);
        return [
          { id: 10, customerId: 5, totalBeforeDiscount: 100, vat: 7, totalAmount: 107 },
          { id: 11, customerId: 5, totalBeforeDiscount: 200, vat: 14, totalAmount: 214 },
        ];
      },
      updateMany: async (query) => { calls.push(['updateMany', query]); },
    },
    combinedBillingDocument: {
      count: async (query) => { calls.push(['count', query]); return 0; },
      create: async (query) => { calls.push(['create', query]); return { id: 7, ...query.data }; },
    },
  };

  const prisma = {
    $transaction: async (work, options) => {
      calls.push(['transaction', options]);
      return work(tx);
    },
  };

  const repository = createCombinedBillingDocumentRepository({ prisma });
  const result = await repository.create({
    branchId: 3,
    employeeId: 8,
    saleIds: [10, 11],
    note: 'monthly',
    now: new Date(2026, 7, 1),
  });

  const findQuery = calls.find(([name]) => name === 'findMany')[1];
  assert.deepEqual(findQuery.where, {
    id: { in: [10, 11] },
    branchId: 3,
    status: 'DELIVERED',
    combinedBillingId: null,
    customerId: { not: null },
  });
  assert.deepEqual(findQuery.orderBy, { soldAt: 'asc' });

  const createQuery = calls.find(([name]) => name === 'create')[1];
  assert.equal(createQuery.data.code, 'CBL-036908-0001');
  assert.equal(createQuery.data.customerId, 5);
  assert.deepEqual(createQuery.data.sales.connect, [{ id: 10 }, { id: 11 }]);

  const updateQuery = calls.find(([name]) => name === 'updateMany')[1];
  assert.deepEqual(updateQuery, {
    where: { id: { in: [10, 11] } },
    data: { status: 'FINALIZED' },
  });
  assert.equal(result.id, 7);
});
