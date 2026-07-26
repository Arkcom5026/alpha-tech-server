const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ListReceiptItemsRepository,
  receiptItemsInclude,
} = require('./listReceiptItemsRepository');
const {
  ListReceiptItemsService,
  ReceiptItemsQueryError,
} = require('./listReceiptItemsService');
const {
  ListReceiptItemsController,
} = require('./listReceiptItemsController');

function createResponse() {
  return {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

test('repository preserves branch-scoped receipt lookup and legacy item projection', async () => {
  const calls = [];
  const repository = new ListReceiptItemsRepository({
    purchaseOrderReceipt: {
      findFirst(args) {
        calls.push(['receipt', args]);
        return { id: 31 };
      },
    },
    purchaseOrderReceiptItem: {
      findMany(args) {
        calls.push(['items', args]);
        return [];
      },
    },
  });

  await repository.findBranchScopedReceipt(31, 4);
  await repository.findItems(31);

  assert.deepEqual(calls[0][1], {
    where: { id: 31, branchId: 4 },
    select: { id: true },
  });
  assert.deepEqual(calls[1][1], {
    where: { receiptId: 31 },
    include: receiptItemsInclude,
    orderBy: [{ id: 'asc' }],
  });
});

test('service rejects unauthorized and invalid receipt ids with stable codes', async () => {
  const service = new ListReceiptItemsService({});

  await assert.rejects(
    service.execute({ receiptId: 1, branchId: undefined }),
    (error) => error instanceof ReceiptItemsQueryError && error.code === 'UNAUTHORIZED'
  );

  await assert.rejects(
    service.execute({ receiptId: 'bad', branchId: 2 }),
    (error) => error instanceof ReceiptItemsQueryError && error.code === 'INVALID_RECEIPT_ID'
  );
});

test('service enforces branch ownership before loading receipt items', async () => {
  let itemsLoaded = false;
  const service = new ListReceiptItemsService({
    findBranchScopedReceipt: async () => null,
    findItems: async () => {
      itemsLoaded = true;
      return [];
    },
  });

  await assert.rejects(
    service.execute({ receiptId: 9, branchId: 2 }),
    (error) => error.code === 'RECEIPT_NOT_FOUND'
  );
  assert.equal(itemsLoaded, false);
});

test('service returns the repository payload without remapping legacy shape', async () => {
  const rows = [{ id: 7, quantity: 2, stockItems: [] }];
  const service = new ListReceiptItemsService({
    findBranchScopedReceipt: async () => ({ id: 9 }),
    findItems: async (receiptId) => {
      assert.equal(receiptId, 9);
      return rows;
    },
  });

  assert.equal(await service.execute({ receiptId: '9', branchId: '2' }), rows);
});

test('controller preserves legacy statuses and unwrapped array response', async () => {
  const rows = [{ id: 8 }];
  const successController = new ListReceiptItemsController({
    execute: async (input) => {
      assert.deepEqual(input, { receiptId: '12', branchId: 5 });
      return rows;
    },
  });
  const successResponse = createResponse();

  await successController.handle(
    { params: { receiptId: '12' }, user: { branchId: 5 } },
    successResponse
  );
  assert.equal(successResponse.statusCode, 200);
  assert.equal(successResponse.payload, rows);

  const unauthorizedController = new ListReceiptItemsController({
    execute: async () => {
      throw new ReceiptItemsQueryError('UNAUTHORIZED', 'unauthorized');
    },
  });
  const unauthorizedResponse = createResponse();
  await unauthorizedController.handle({ params: {} }, unauthorizedResponse);
  assert.equal(unauthorizedResponse.statusCode, 401);
  assert.deepEqual(unauthorizedResponse.payload, { error: 'unauthorized' });
});
