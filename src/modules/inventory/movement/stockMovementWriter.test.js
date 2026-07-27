const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  StockMovementWriter,
  createStockMovement,
  createStockMovements,
  isStockMovementAuthorizedClient,
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

test('the shared Prisma singleton installs inventory movement authority', () => {
  const prismaPath = path.resolve(__dirname, '../../../../lib/prisma.js');
  const source = fs.readFileSync(prismaPath, 'utf8');

  assert.match(source, /authorizeStockMovementClient/);
  assert.match(source, /_prismaRaw/);
  assert.match(source, /_prisma\s*\?\?=\s*authorizeStockMovementClient/);
});

test('remaining stock movement runtimes use the authorized Prisma singleton', () => {
  const runtimePaths = [
    '../../../../controllers/receiptSimpleController.js',
    '../../../../controllers/purchaseOrderReceiptSimpleController.js',
    '../../sales/completion/services/saleCompletionService.js',
    '../../sales/create/controllers/saleLegacyCreateController.js',
  ];

  for (const relativePath of runtimePaths) {
    const absolutePath = path.resolve(__dirname, relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');

    assert.match(source, /stockMovement\.(create|createMany)\s*\(/);
    assert.match(source, /lib\/prisma/);
    assert.doesNotMatch(source, /new\s+PrismaClient\s*\(/);
  }
});

test('transaction clients are wrapped before application work executes', async () => {
  let rawMovementQuery;
  const rawTransactionClient = {
    stockMovement: {
      create: async (query) => {
        rawMovementQuery = query;
        return { id: 91 };
      },
    },
  };
  const rawClient = {
    stockMovement: rawTransactionClient.stockMovement,
    $transaction: async (work) => work(rawTransactionClient),
  };

  const authorized = authorizeStockMovementClient(rawClient);
  await authorized.$transaction((tx) => tx.stockMovement.create({
    data: { productId: 1, branchId: 1, qty: 1, type: 'RECEIVE' },
  }));

  assert.equal(rawMovementQuery.data.type, 'RECEIVE');
});

test('movement authority wrapping is idempotent across repeated calls', () => {
  const rawClient = {
    stockMovement: {
      create: async () => ({ id: 1 }),
      createMany: async () => ({ count: 0 }),
    },
  };

  const first = authorizeStockMovementClient(rawClient);
  const second = authorizeStockMovementClient(first);

  assert.equal(first, second);
  assert.equal(isStockMovementAuthorizedClient(first), true);
  assert.equal(isStockMovementAuthorizedClient(rawClient), false);
});
