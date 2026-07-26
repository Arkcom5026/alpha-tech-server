const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CreatePurchaseReceiptRepository,
  purchaseOrderProjection,
} = require('./createPurchaseReceiptRepository');
const {
  CreatePurchaseReceiptService,
  CreatePurchaseReceiptError,
} = require('./createPurchaseReceiptService');
const {
  CreatePurchaseReceiptController,
} = require('./createPurchaseReceiptController');

test('repository preserves branch-scoped purchase order projection', async () => {
  let receivedArgs;
  const client = {
    purchaseOrder: {
      findFirst: async (args) => {
        receivedArgs = args;
        return null;
      },
    },
  };
  const repository = new CreatePurchaseReceiptRepository(client);

  await repository.findPurchaseOrder(11, 7);

  assert.deepEqual(receivedArgs, {
    where: { id: 11, branchId: 7 },
    select: purchaseOrderProjection,
  });
});

test('service preserves validation and branch ownership failures', async () => {
  const service = new CreatePurchaseReceiptService({
    findPurchaseOrder: async () => null,
  });

  await assert.rejects(
    () => service.execute({ purchaseOrderId: 1, branchId: 0, employeeId: 2 }),
    (error) =>
      error instanceof CreatePurchaseReceiptError &&
      error.statusCode === 400 &&
      error.message === 'ข้อมูลไม่ครบ (purchaseOrderId/branchId/employeeId)'
  );

  await assert.rejects(
    () => service.execute({ purchaseOrderId: 1, branchId: 3, employeeId: 2 }),
    (error) =>
      error instanceof CreatePurchaseReceiptError &&
      error.statusCode === 404 &&
      error.message === 'ไม่พบใบสั่งซื้อในสาขานี้'
  );
});

test('service creates receipt then performs non-fatal branch price upserts', async () => {
  const calls = [];
  const warnings = [];
  const created = { id: 9, code: 'RC-0307-0001' };
  const service = new CreatePurchaseReceiptService(
    {
      findPurchaseOrder: async () => ({
        id: 4,
        branchId: 3,
        items: [
          { productId: 10, costPrice: 120 },
          { productId: 11, costPrice: 220 },
        ],
      }),
      createWithUniqueCode: async (input) => {
        calls.push(['create', input]);
        return created;
      },
      upsertBranchPrice: async (input) => {
        calls.push(['price', input]);
        if (input.productId === 11) throw new Error('price failed');
      },
    },
    { warn: (...args) => warnings.push(args) }
  );

  const result = await service.execute({
    purchaseOrderId: '4',
    branchId: '3',
    employeeId: '8',
    note: 'note',
    supplierTaxInvoiceNumber: 'INV-1',
    supplierTaxInvoiceDate: '2026-07-27',
    receivedAt: '2026-07-28',
  });

  assert.equal(result, created);
  assert.equal(calls[0][0], 'create');
  assert.equal(calls[0][1].purchaseOrderId, 4);
  assert.equal(calls[0][1].branchId, 3);
  assert.equal(calls[0][1].employeeId, 8);
  assert.equal(calls.filter(([kind]) => kind === 'price').length, 2);
  assert.equal(warnings.length, 1);
});

test('controller preserves legacy status codes and response shapes', async () => {
  const created = { id: 5 };
  const successController = new CreatePurchaseReceiptController({
    execute: async (input) => {
      assert.equal(input.branchId, 2);
      assert.equal(input.employeeId, 7);
      assert.equal(input.purchaseOrderId, 3);
      return created;
    },
  });
  const success = createResponse();
  await successController.handle(
    { body: { purchaseOrderId: 3 }, user: { branchId: 2, employeeId: 7 } },
    success
  );
  assert.equal(success.statusCode, 201);
  assert.equal(success.body, created);

  const invalidController = new CreatePurchaseReceiptController({
    execute: async () => {
      throw new CreatePurchaseReceiptError('INVALID_INPUT', 'ข้อมูลไม่ครบ', 400);
    },
  });
  const invalid = createResponse();
  await invalidController.handle({ body: {}, user: {} }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(invalid.body, { error: 'ข้อมูลไม่ครบ' });
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
