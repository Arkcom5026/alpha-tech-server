const assert = require('assert');
const test = require('node:test');

const GetCombinableSalesRepository = require('./getCombinableSalesRepository');
const GetCombinableSalesService = require('./getCombinableSalesService');

test('repository preserves branch scope and combinable sale rules', async () => {
  let receivedQuery;
  const repository = new GetCombinableSalesRepository({
    sale: {
      findMany: async (query) => {
        receivedQuery = query;
        return [];
      },
    },
  });

  await repository.listByBranch(7);

  assert.deepEqual(receivedQuery.where, {
    branchId: 7,
    isCredit: true,
    status: { not: 'CANCELLED' },
    statusPayment: { in: ['PARTIALLY_PAID', 'PAID'] },
    customerId: { not: null },
  });
  assert.deepEqual(receivedQuery.include, { customer: true });
  assert.deepEqual(receivedQuery.orderBy, { soldAt: 'desc' });
});

test('service rejects missing branch authority before repository access', async () => {
  let called = false;
  const service = new GetCombinableSalesService({
    listByBranch: async () => {
      called = true;
      return [];
    },
  });

  await assert.rejects(
    () => service.execute(null),
    (error) => error.code === 'BRANCH_CONTEXT_REQUIRED' && error.statusCode === 401
  );
  assert.equal(called, false);
});

test('service returns repository payload without remapping API shape', async () => {
  const expected = [{ id: 1, branchId: 3 }];
  const service = new GetCombinableSalesService({
    listByBranch: async (branchId) => {
      assert.equal(branchId, 3);
      return expected;
    },
  });

  const result = await service.execute(3);
  assert.equal(result, expected);
});
