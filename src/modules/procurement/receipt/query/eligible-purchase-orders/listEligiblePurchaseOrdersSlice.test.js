const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ListEligiblePurchaseOrdersRepository,
  eligiblePurchaseOrderSelect,
} = require('./listEligiblePurchaseOrdersRepository');
const {
  ListEligiblePurchaseOrdersService,
  EligiblePurchaseOrdersQueryError,
} = require('./listEligiblePurchaseOrdersService');
const {
  ListEligiblePurchaseOrdersController,
} = require('./listEligiblePurchaseOrdersController');

test('repository preserves branch scope, eligible statuses, projection, and ordering', async () => {
  let receivedArgs;
  const client = {
    purchaseOrder: {
      findMany: async (args) => {
        receivedArgs = args;
        return [];
      },
    },
  };
  const repository = new ListEligiblePurchaseOrdersRepository(client);
  await repository.findMany(7);

  assert.deepEqual(receivedArgs, {
    where: {
      branchId: 7,
      status: { in: ['PENDING', 'PARTIALLY_RECEIVED'] },
    },
    select: eligiblePurchaseOrderSelect,
    orderBy: { createdAt: 'desc' },
  });
});

test('service rejects missing branch authority', () => {
  const service = new ListEligiblePurchaseOrdersService({ findMany: async () => [] });
  assert.throws(
    () => service.execute({ branchId: undefined }),
    (error) => error instanceof EligiblePurchaseOrdersQueryError && error.code === 'UNAUTHORIZED'
  );
});

test('service returns repository payload without remapping legacy response', async () => {
  const payload = [{ id: 1, code: 'PO-1', status: 'PENDING' }];
  const service = new ListEligiblePurchaseOrdersService({
    findMany: async (branchId) => {
      assert.equal(branchId, 3);
      return payload;
    },
  });
  assert.equal(await service.execute({ branchId: '3' }), payload);
});

test('controller preserves unauthorized and unwrapped array responses', async () => {
  const unauthorizedController = new ListEligiblePurchaseOrdersController({
    execute: async () => {
      throw new EligiblePurchaseOrdersQueryError('UNAUTHORIZED', 'unauthorized');
    },
  });
  const unauthorized = createResponse();
  await unauthorizedController.handle({ user: {} }, unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  assert.deepEqual(unauthorized.body, { error: 'unauthorized' });

  const payload = [{ id: 2 }];
  const controller = new ListEligiblePurchaseOrdersController({ execute: async () => payload });
  const response = createResponse();
  await controller.handle({ user: { branchId: 1 } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, payload);
});

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}
