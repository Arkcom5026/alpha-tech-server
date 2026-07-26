const test = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');

const {
  GetPurchaseReceiptRepository,
  receiptDetailInclude,
} = require('./getPurchaseReceiptRepository');
const {
  GetPurchaseReceiptService,
  ReceiptNotFoundError,
  PurchaseOrderMissingError,
} = require('./getPurchaseReceiptService');
const { GetPurchaseReceiptController } = require('./getPurchaseReceiptController');

test('repository preserves branch scope and legacy detail projection', async () => {
  const calls = [];
  const repository = new GetPurchaseReceiptRepository({
    purchaseOrderReceipt: {
      findFirst: async (args) => {
        calls.push(args);
        return { id: 7 };
      },
    },
  });

  await repository.findReceiptById(7, 3);
  assert.deepEqual(calls[0], {
    where: { id: 7, branchId: 3 },
    include: receiptDetailInclude,
  });
});

test('repository loads all receipt ids and payment links for the same PO', async () => {
  const client = {
    purchaseOrderReceipt: {
      findMany: async (args) => {
        assert.deepEqual(args, {
          where: { purchaseOrderId: 11 },
          select: { id: true },
        });
        return [{ id: 1 }, { id: 2 }];
      },
    },
    supplierPaymentReceipt: {
      findMany: async (args) => {
        assert.deepEqual(args, {
          where: { receiptId: { in: [1, 2] } },
          select: { amountPaid: true },
        });
        return [{ amountPaid: new Prisma.Decimal('25.50') }];
      },
    },
  };

  const repository = new GetPurchaseReceiptRepository(client);
  const ids = await repository.findReceiptIdsByPurchaseOrderId(11);
  const links = await repository.findPaymentLinksByReceiptIds(ids);
  assert.deepEqual(ids, [1, 2]);
  assert.equal(links.length, 1);
});

test('service maps items and computes supplier debitAmount using legacy semantics', async () => {
  const repository = {
    findReceiptById: async () => ({
      id: 7,
      items: [
        {
          id: 21,
          quantity: new Prisma.Decimal('2'),
          purchaseOrderItem: {
            product: { name: 'Printer', unit: null },
          },
        },
      ],
      purchaseOrder: {
        id: 11,
        code: 'PO-001',
        supplier: {
          id: 4,
          name: 'Supplier A',
          creditLimit: new Prisma.Decimal('1000'),
          creditBalance: new Prisma.Decimal('800'),
        },
      },
    }),
    findReceiptIdsByPurchaseOrderId: async () => [7, 8],
    findPaymentLinksByReceiptIds: async () => [
      { amountPaid: new Prisma.Decimal('100.25') },
      { amountPaid: new Prisma.Decimal('50.75') },
    ],
  };

  const result = await new GetPurchaseReceiptService(repository).execute({ id: 7, branchId: 3 });
  assert.equal(result.items[0].productName, 'Printer');
  assert.equal(result.items[0].unitName, 'N/A');
  assert.equal(result.purchaseOrder.supplier.creditLimit, 1000);
  assert.equal(result.purchaseOrder.supplier.creditBalance, 800);
  assert.equal(result.purchaseOrder.supplier.debitAmount, 151);
});

test('service exposes distinct not-found and missing-PO failures', async () => {
  const notFoundService = new GetPurchaseReceiptService({
    findReceiptById: async () => null,
  });
  await assert.rejects(
    () => notFoundService.execute({ id: 1, branchId: 1 }),
    ReceiptNotFoundError
  );

  const missingPoService = new GetPurchaseReceiptService({
    findReceiptById: async () => ({ items: [], purchaseOrder: null }),
  });
  await assert.rejects(
    () => missingPoService.execute({ id: 1, branchId: 1 }),
    PurchaseOrderMissingError
  );
});

test('controller preserves validation, cache header, and unwrapped response', async () => {
  const payload = { id: 7, code: 'RC-001' };
  const controller = new GetPurchaseReceiptController({
    execute: async (input) => {
      assert.deepEqual(input, { id: 7, branchId: 3 });
      return payload;
    },
  });

  const headers = {};
  const response = {
    statusCode: 200,
    body: null,
    set(name, value) {
      headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await controller.handle({ params: { id: '7' }, user: { branchId: 3 } }, response);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, payload);

  const invalid = { ...response, statusCode: 200, body: null };
  await controller.handle({ params: { id: 'bad' }, user: { branchId: 3 } }, invalid);
  assert.equal(invalid.statusCode, 400);
  assert.deepEqual(invalid.body, { error: 'Missing or invalid receipt ID' });
});
