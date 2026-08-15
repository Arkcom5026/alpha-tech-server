const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  authorizeStockMovementClient,
  createStockMovement,
  createStockMovements,
} = require('./stockMovementWriter');

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..');

const walkJavaScriptFiles = (directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'artifacts') return [];
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkJavaScriptFiles(absolutePath);
    return entry.isFile() && entry.name.endsWith('.js') ? [absolutePath] : [];
  });
};

test('stock movement writer delegates one movement without remapping runtime data', async () => {
  let received;
  const client = {
    stockMovement: {
      create: async (query) => {
        received = query;
        return { id: 1, ...query.data };
      },
    },
  };

  const data = { productId: 1, branchId: 2, qty: 3, type: 'RECEIVE' };
  const result = await createStockMovement(client, data);

  assert.deepEqual(received, { data });
  assert.deepEqual(result, { id: 1, ...data });
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
    { productId: 1, branchId: 2, qty: 3, type: 'RECEIVE' },
    { productId: 2, branchId: 2, qty: -1, type: 'SALE' },
  ];
  const result = await createStockMovements(client, movements);

  assert.deepEqual(received, { data: movements });
  assert.deepEqual(result, { count: 2 });
});

test('empty movement batches are a no-op and never call Prisma', async () => {
  let called = false;
  const client = {
    stockMovement: {
      createMany: async () => {
        called = true;
      },
    },
  };

  assert.deepEqual(await createStockMovements(client, []), { count: 0 });
  assert.equal(called, false);
});

test('writer refuses clients without stock movement persistence capability', () => {
  assert.throws(() => createStockMovement({}, {}), /Prisma stockMovement client is required/);
  assert.throws(() => createStockMovements({}, [{}]), /Prisma stockMovement client is required/);
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
    '../recovery/simple-stock-backfill/execution/simpleStockBackfillExecutionRepository.js',
    '../simple-stock/adjust/simpleStockAdjustmentRepository.js',
    '../simple-stock/transfer/simpleStockTransferRepository.js',
    '../stock-item/receive/stockItemReceiveSlices.js',
    '../../procurement/receipt/commit/commitReceiptRepository.js',
    '../../procurement/receipt/simple/runtime/receiptSimpleRuntimeRepository.js',
    '../../repair/claim/status/updateWarrantyClaimStatusRepository.js',
    '../../sales/completion/services/saleCompletionService.js',
    '../../sales/create/controllers/saleLegacyCreateController.js',
  ];

  for (const relativePath of runtimePaths) {
    const absolutePath = path.resolve(__dirname, relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');

    assert.match(source, /stockMovement\.(create|createMany)\s*\(/);

    const usesDirectAuthority = /(lib\/prisma|database\/prisma\/client)/.test(source);
    const sharedImport = source.match(/require\(['"](\.\.\/shared\/stockItemShared)['"]\)/);
    if (sharedImport) {
      const sharedPath = path.resolve(path.dirname(absolutePath), `${sharedImport[1]}.js`);
      const sharedSource = fs.readFileSync(sharedPath, 'utf8');
      assert.match(sharedSource, /lib\/prisma/);
    }
    assert.equal(usesDirectAuthority || Boolean(sharedImport), true);
    assert.doesNotMatch(source, /new\s+PrismaClient\s*\(/);
  }
});

test('controlled repair script keeps its scoped movement-repair guards', () => {
  const scriptPath = path.resolve(REPOSITORY_ROOT, 'scripts/repair-stock-receipt-receive-movements.js');
  const source = fs.readFileSync(scriptPath, 'utf8');

  assert.match(source, /ALLOW_MAIN_DATABASE_STOCK_RECEIPT_REPAIR/);
  assert.match(source, /CONFIRM_STOCK_RECEIPT_REPAIR_SCOPE/);
  assert.match(source, /prisma\.\$transaction/);
  assert.match(source, /stockMovement\.findFirst/);
  assert.match(source, /stockMovement\.create/);
});

test('repository production runtime cannot add an unregistered direct stock movement writer', () => {
  const authorityTestPath = path.resolve(__filename);
  const writerPath = path.resolve(__dirname, 'stockMovementWriter.js');
  const allowedRuntimeWriters = new Set([
    path.resolve(REPOSITORY_ROOT, 'scripts/repair-stock-receipt-receive-movements.js'),
    path.resolve(REPOSITORY_ROOT, 'src/modules/inventory/recovery/simple-stock-backfill/execution/simpleStockBackfillExecutionRepository.js'),
    path.resolve(REPOSITORY_ROOT, 'src/modules/inventory/simple-stock/adjust/simpleStockAdjustmentRepository.js'),
    path.resolve(REPOSITORY_ROOT, 'src/modules/inventory/simple-stock/transfer/simpleStockTransferRepository.js'),
    path.resolve(REPOSITORY_ROOT, 'src/modules/inventory/stock-item/receive/stockItemReceiveSlices.js'),
    path.resolve(REPOSITORY_ROOT, 'src/modules/procurement/receipt/commit/commitReceiptRepository.js'),
    path.resolve(REPOSITORY_ROOT, 'src/modules/procurement/receipt/simple/runtime/receiptSimpleRuntimeRepository.js'),
    path.resolve(REPOSITORY_ROOT, 'src/modules/repair/claim/status/updateWarrantyClaimStatusRepository.js'),
    path.resolve(REPOSITORY_ROOT, 'src/modules/sales/completion/services/saleCompletionService.js'),
    path.resolve(REPOSITORY_ROOT, 'src/modules/sales/create/controllers/saleLegacyCreateController.js'),
  ]);

  const discovered = walkJavaScriptFiles(REPOSITORY_ROOT)
    .filter((file) => file !== authorityTestPath && file !== writerPath)
    .filter((file) => /stockMovement\.(create|createMany)\s*\(/.test(fs.readFileSync(file, 'utf8')));

  assert.deepEqual(
    discovered.map((file) => path.relative(REPOSITORY_ROOT, file).replaceAll('\\', '/')).sort(),
    [...allowedRuntimeWriters]
      .map((file) => path.relative(REPOSITORY_ROOT, file).replaceAll('\\', '/'))
      .sort()
  );
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

  assert.deepEqual(rawMovementQuery, {
    data: { productId: 1, branchId: 1, qty: 1, type: 'RECEIVE' },
  });
});

test('movement authority wrapping is idempotent across repeated calls', () => {
  const client = {
    stockMovement: {
      create: async () => ({ id: 1 }),
      createMany: async () => ({ count: 1 }),
    },
    $transaction: async (work) => work(client),
  };

  const once = authorizeStockMovementClient(client);
  const twice = authorizeStockMovementClient(once);

  assert.equal(twice, once);
});