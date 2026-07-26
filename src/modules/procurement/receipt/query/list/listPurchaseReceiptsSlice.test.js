const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ListPurchaseReceiptsRepository,
} = require('./listPurchaseReceiptsRepository');
const {
  ListPurchaseReceiptsService,
  normalizeFilters,
  mapReceipt,
} = require('./listPurchaseReceiptsService');
const {
  ListPurchaseReceiptsController,
} = require('./listPurchaseReceiptsController');

test('normalizeFilters preserves legacy query semantics', () => {
  assert.deepEqual(
    normalizeFilters({
      printed: 'TRUE',
      q: ' RC-01 ',
      supplier: ' ACME ',
      supplierId: '42',
    }),
    {
      printed: true,
      q: 'RC-01',
      supplier: 'ACME',
      supplierId: 42,
    }
  );

  assert.equal(normalizeFilters({ printed: 'other' }).printed, undefined);
  assert.equal(normalizeFilters({ supplierId: '' }).supplierId, undefined);
});

test('repository enforces branch scope, filters, projection, and ordering', async () => {
  let receivedArgs;
  const client = {
    purchaseOrderReceipt: {
      findMany: async (args) => {
        receivedArgs = args;
        return [];
      },
    },
  };
  const repository = new ListPurchaseReceiptsRepository(client);

  await repository.findMany(7, {
    printed: false,
    q: 'RC-07',
    supplier: 'Supplier',
    supplierId: 9,
  });

  assert.deepEqual(receivedArgs.orderBy, { receivedAt: 'desc' });
  assert.equal(receivedArgs.where.AND[0].branchId, 7);
  assert.deepEqual(receivedArgs.where.AND[1], { printed: false });
  assert.equal(receivedArgs.select.purchaseOrder.select.supplier.select.name, true);
  assert.equal(receivedArgs.where.AND.length, 5);
});

test('service maps repository rows to the existing API response shape', async () => {
  const repository = {
    findMany: async () => [
      {
        id: 1,
        code: 'RC-0101-0001',
        receivedAt: new Date('2026-07-01T00:00:00.000Z'),
        printed: false,
        purchaseOrder: {
          code: 'PO-001',
          supplier: { id: 3, name: 'Supplier A' },
        },
      },
    ],
  };
  const service = new ListPurchaseReceiptsService(repository);
  const result = await service.execute(1, {});

  assert.deepEqual(result.items[0], {
    id: 1,
    receiptCode: 'RC-0101-0001',
    poCode: 'PO-001',
    supplierId: 3,
    supplierName: 'Supplier A',
    receivedAt: new Date('2026-07-01T00:00:00.000Z'),
    printed: false,
  });
  assert.deepEqual(mapReceipt({ id: 2, code: 'RC-X', printed: true }), {
    id: 2,
    receiptCode: 'RC-X',
    poCode: '-',
    supplierId: null,
    supplierName: '-',
    receivedAt: undefined,
    printed: true,
  });
});

test('controller preserves cache headers and unauthorized response', async () => {
  const controller = new ListPurchaseReceiptsController({
    execute: async () => {
      throw new Error('service must not run');
    },
  });
  const headers = {};
  const res = {
    set(name, value) {
      headers[name] = value;
      return this;
    },
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await controller.handle({ user: null, query: {} }, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.payload, { error: 'unauthorized' });
  assert.equal(headers.Pragma, 'no-cache');
  assert.equal(headers.Expires, '0');
  assert.match(headers.ETag, /^W\/"\d+"$/);
});

test('controller returns the list payload without wrapping it', async () => {
  const expected = [{ id: 1, receiptCode: 'RC-1' }];
  const controller = new ListPurchaseReceiptsController({
    execute: async (branchId, query) => {
      assert.equal(branchId, 4);
      assert.deepEqual(query, { printed: 'false' });
      return {
        items: expected,
        filters: {
          printed: false,
          q: '',
          supplier: '',
          supplierId: undefined,
        },
      };
    },
  });
  const res = {
    set() {
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  await controller.handle(
    { user: { branchId: 4 }, query: { printed: 'false' } },
    res
  );

  assert.deepEqual(res.payload, expected);
});
