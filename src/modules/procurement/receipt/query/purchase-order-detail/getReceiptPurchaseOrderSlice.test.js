const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GetReceiptPurchaseOrderRepository,
  receiptPurchaseOrderInclude,
} = require('./getReceiptPurchaseOrderRepository');
const {
  GetReceiptPurchaseOrderService,
  ReceiptPurchaseOrderQueryError,
} = require('./getReceiptPurchaseOrderService');
const {
  GetReceiptPurchaseOrderController,
} = require('./getReceiptPurchaseOrderController');

test('repository preserves branch scope and legacy include graph', async () => {
  let receivedArgs;
  const client = {
    purchaseOrder: {
      findFirst: async (args) => {
        receivedArgs = args;
        return null;
      },
    },
  };
  const repository = new GetReceiptPurchaseOrderRepository(client);
  await repository.findByIdAndBranch(12, 4);
  assert.deepEqual(receivedArgs, {
    where: { id: 12, branchId: 4 },
    include: receiptPurchaseOrderInclude,
  });
});

test('service computes receivedQuantity using all receipt items', async () => {
  const decimalLike = { toNumber: () => 2.5 };
  const purchaseOrder = {
    id: 1,
    items: [
      {
        id: 10,
        receipts: [{ quantity: decimalLike }, { quantity: '1.5' }],
      },
      { id: 11, receipts: [] },
    ],
  };
  const service = new GetReceiptPurchaseOrderService({
    findByIdAndBranch: async (id, branchId) => {
      assert.equal(id, 1);
      assert.equal(branchId, 2);
      return purchaseOrder;
    },
  });

  const result = await service.execute({ id: '1', branchId: '2' });
  assert.equal(result.items[0].receivedQuantity, 4);
  assert.equal(result.items[1].receivedQuantity, 0);
});

test('service exposes unauthorized and not-found failures', async () => {
  const service = new GetReceiptPurchaseOrderService({
    findByIdAndBranch: async () => null,
  });

  await assert.rejects(
    () => service.execute({ id: 1, branchId: undefined }),
    (error) => error instanceof ReceiptPurchaseOrderQueryError && error.code === 'UNAUTHORIZED'
  );
  await assert.rejects(
    () => service.execute({ id: 1, branchId: 2 }),
    (error) => error instanceof ReceiptPurchaseOrderQueryError && error.code === 'NOT_FOUND'
  );
});

test('controller preserves legacy statuses and unwrapped response', async () => {
  const notFoundController = new GetReceiptPurchaseOrderController({
    execute: async () => {
      throw new ReceiptPurchaseOrderQueryError('NOT_FOUND', 'ไม่พบใบสั่งซื้อนี้');
    },
  });
  const notFound = createResponse();
  await notFoundController.handle({ params: { id: '1' }, user: { branchId: 2 } }, notFound);
  assert.equal(notFound.statusCode, 404);
  assert.deepEqual(notFound.body, { error: 'ไม่พบใบสั่งซื้อนี้' });

  const payload = { id: 1, items: [] };
  const controller = new GetReceiptPurchaseOrderController({ execute: async () => payload });
  const response = createResponse();
  await controller.handle({ params: { id: '1' }, user: { branchId: 2 } }, response);
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
