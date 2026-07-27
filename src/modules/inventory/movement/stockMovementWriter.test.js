const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  StockMovementWriter,
  createStockMovement,
  createStockMovements,
  authorizeStockMovementClient,
} = require('./stockMovementWriter');

test('stock movement writer delegates one movement without remapping runtime data', async () => {
  let received;
  const client = {
    stockMovement: {
      create: async (query) => {
        received = query;
        return { id: 41, ...query.data };
      },
    },
  };
  const movement = {
    productId: 7,
    branchId: 2,
    qty: -1,
    type: 'SALE',
    refType: 'SALE',
    refId: 9,
  };

  const result = await createStockMovement(client, movement);

  assert.equal(received.data, movement);
  assert.equal(result.id, 41);
});

test('stock movement writer delegates movement batches atomically through Prisma createMany', async () => {
  let received;
  const client = {
    stockMovement: {
      createMany: async (query) => {
        received = query;
        return { count: query.data.length };
      },
    },
  };
  const movements = [
    { productId: 1, branchId: 3, qty: -1, type: 'SALE' },
    { productId: 2, branchId: 3, qty: 1, type: 'RETURN' },
  ];

  const result = await createStockMovements(client, movements);

  assert.equal(received.data, movements);
  assert.equal(result.count, 2);
});

test('empty movement batches are a no-op and never call Prisma', async () => {
  let called = false;
  const client = {
    stockMovement: {
      createMany: async () => {
        called = true;
        return { count: 99 };
      },
    },
  };

  const result = await createStockMovements(client, []);

  assert.deepEqual(result, { count: 0 });
  assert.equal(called, false);
});

test('writer refuses clients without stock movement persistence capability', () => {
  assert.throws(
    () => new StockMovementWriter({}),
    /Prisma stockMovement client is required/
  );
});

test('quick stock repository delegates movement persistence to inventory authority', () => {
  const repositoryPath = path.resolve(
    __dirname,
    '../../product/quickStock/repositories/quickStockRepository.js'
  );
  const source = fs.readFileSync(repositoryPath, 'utf8');

  assert.match(source, /inventory\/movement\/stockMovementWriter/);
  assert.doesNotMatch(source, /client\.stockMovement\.create\s*\(/);
  assert.doesNotMatch(source, /client\.stockMovement\.createMany\s*\(/);
});

test('authorized prisma client intercepts direct movement writes without changing payloads', async () => {
  const calls = [];
  const rawClient = {
    stockMovement: {
      create: async (query) => {
        calls.push(['create', query]);
        return { id: 1, ...query.data };
      },
      createMany: async (query) => {
        calls.push(['createMany', query]);
        return { count: query.data.length };
      },
    },
  };
  const client = authorizeStockMovementClient(rawClient);
  const one = { branchId: 1, productId: 2, qty: -1, type: 'SALE' };
  const many = [{ branchId: 1, productId: 3, qty: 1, type: 'RETURN' }];

  await client.stockMovement.create({ data: one });
  await client.stockMovement.createMany({ data: many });

  assert.equal(calls[0][1].data, one);
  assert.equal(calls[1][1].data, many);
});

test('authorized prisma client also governs transaction-scoped movement writes', async () => {
  const calls = [];
  const transactionClient = {
    stockMovement: {
      create: async (query) => {
        calls.push(query);
        return { id: 9, ...query.data };
      },
    },
  };
  const rawClient = {
    stockMovement: transactionClient.stockMovement,
    $transaction: async (work) => work(transactionClient),
  };
  const client = authorizeStockMovementClient(rawClient);
  const movement = { branchId: 4, productId: 5, qty: 1, type: 'RECEIVE' };

  const result = await client.$transaction((tx) => tx.stockMovement.create({ data: movement }));

  assert.equal(calls[0].data, movement);
  assert.equal(result.id, 9);
});