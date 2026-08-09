const test = require('node:test');
const assert = require('node:assert/strict');

const { GetCombinedBillingByIdRepository } = require('./getCombinedBillingByIdRepository');
const { GetCombinedBillingByIdService } = require('./getCombinedBillingByIdService');

test('repository scopes combined billing detail by document id and branch', async () => {
  let capturedQuery;
  const repository = new GetCombinedBillingByIdRepository({
    combinedBillingDocument: {
      findFirst: async (query) => {
        capturedQuery = query;
        return { id: 7, branchId: 2 };
      },
    },
  });

  const result = await repository.findByIdForBranch({ id: 7, branchId: 2 });

  assert.deepEqual(capturedQuery.where, { id: 7, branchId: 2 });
  assert.deepEqual(capturedQuery.include, {
    customer: true,
    employee: true,
    sales: true,
    documentLines: { orderBy: { id: 'asc' } },
  });
  assert.equal(result.id, 7);
});

test('service rejects incomplete identity before repository access', async () => {
  let called = false;
  const service = new GetCombinedBillingByIdService({
    findByIdForBranch: async () => {
      called = true;
      return null;
    },
  });

  await assert.rejects(
    () => service.execute({ id: undefined, branchId: 2 }),
    (error) => error.code === 'COMBINED_BILLING_DETAIL_INVALID_CONTEXT' && error.statusCode === 400,
  );
  assert.equal(called, false);
});

test('service preserves branch-safe not-found contract', async () => {
  const service = new GetCombinedBillingByIdService({
    findByIdForBranch: async () => null,
  });

  await assert.rejects(
    () => service.execute({ id: 7, branchId: 2 }),
    (error) => error.code === 'COMBINED_BILLING_NOT_FOUND' && error.statusCode === 404,
  );
});
