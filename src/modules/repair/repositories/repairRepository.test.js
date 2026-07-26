const test = require('node:test');
const assert = require('node:assert/strict');
const { RepairRepository } = require('./repairRepository');

function createClient() {
  const calls = [];
  const record = (model, method) => async (args) => {
    calls.push({ model, method, args });
    return { model, method, args };
  };

  return {
    calls,
    $transaction: async (work) => work(createClient()),
    stockItem: {
      findFirst: record('stockItem', 'findFirst'),
      findUnique: record('stockItem', 'findUnique'),
      findMany: record('stockItem', 'findMany'),
    },
    customerProfile: { findUnique: record('customerProfile', 'findUnique') },
    saleItemSimple: { findMany: record('saleItemSimple', 'findMany') },
    employeeProfile: { findUnique: record('employeeProfile', 'findUnique') },
    supplier: { findUnique: record('supplier', 'findUnique') },
    product: { findUnique: record('product', 'findUnique') },
    stockBalance: {
      findUnique: record('stockBalance', 'findUnique'),
      update: record('stockBalance', 'update'),
    },
    branchPrice: { findUnique: record('branchPrice', 'findUnique') },
    repairJob: {
      create: record('repairJob', 'create'),
      findFirst: record('repairJob', 'findFirst'),
      findMany: record('repairJob', 'findMany'),
      update: record('repairJob', 'update'),
    },
    repairPartItem: { create: record('repairPartItem', 'create') },
    stockMovement: { create: record('stockMovement', 'create') },
    warrantyClaim: {
      create: record('warrantyClaim', 'create'),
      findFirst: record('warrantyClaim', 'findFirst'),
      findMany: record('warrantyClaim', 'findMany'),
      update: record('warrantyClaim', 'update'),
    },
  };
}

test('findStockItemForIntake scopes lookup by branch and supports numeric identity', async () => {
  const client = createClient();
  const repository = new RepairRepository(client);

  await repository.findStockItemForIntake('7', '42');

  const [{ args }] = client.calls;
  assert.deepEqual(args.where, {
    branchId: 7,
    OR: [{ barcode: '42' }, { serialNumber: '42' }, { id: 42 }],
  });
  assert.equal(args.include, RepairRepository.stockItemIntakeInclude);
});

test('findStockItemForIntake omits invalid numeric id clause', async () => {
  const client = createClient();
  const repository = new RepairRepository(client);

  await repository.findStockItemForIntake(7, 'SN-001');

  assert.deepEqual(client.calls[0].args.where.OR, [
    { barcode: 'SN-001' },
    { serialNumber: 'SN-001' },
  ]);
});

test('customer warranty stock query is branch-safe and customer-safe', async () => {
  const client = createClient();
  const repository = new RepairRepository(client);

  await repository.findCustomerWarrantyStockItems('7', '20');

  const [{ args }] = client.calls;
  assert.equal(args.where.branchId, 7);
  assert.deepEqual(args.where.saleItems.some.sale, { customerId: 20, branchId: 7 });
  assert.deepEqual(args.include.saleItems.where.sale, { customerId: 20, branchId: 7 });
  assert.equal(args.include.saleItems.take, 1);
});

test('repair detail lookup and list always retain branch scope', async () => {
  const client = createClient();
  const repository = new RepairRepository(client);

  await repository.findRepairJob('7', '100');
  await repository.listRepairJobs('7', {
    status: 'IN_PROGRESS',
    stockItemId: 8,
    customerId: 20,
    limit: 25,
    offset: 5,
  });

  assert.deepEqual(client.calls[0].args.where, { id: 100, branchId: 7 });
  assert.deepEqual(client.calls[1].args.where, {
    branchId: 7,
    status: 'IN_PROGRESS',
    stockItemId: 8,
    customerId: 20,
  });
  assert.equal(client.calls[1].args.take, 25);
  assert.equal(client.calls[1].args.skip, 5);
});

test('warranty detail lookup and list always retain branch scope', async () => {
  const client = createClient();
  const repository = new RepairRepository(client);

  await repository.findWarrantyClaim('7', '50');
  await repository.listWarrantyClaims('7', {
    status: 'SUBMITTED',
    stockItemId: 8,
    limit: 10,
    offset: 2,
  });

  assert.deepEqual(client.calls[0].args.where, { id: 50, branchId: 7 });
  assert.deepEqual(client.calls[1].args.where, {
    branchId: 7,
    status: 'SUBMITTED',
    stockItemId: 8,
  });
  assert.equal(client.calls[1].args.take, 10);
  assert.equal(client.calls[1].args.skip, 2);
});

test('stock decrement uses branch-product composite identity', async () => {
  const client = createClient();
  const repository = new RepairRepository(client);

  await repository.decrementStockBalance('7', '30', 2);

  assert.deepEqual(client.calls[0].args, {
    where: { productId_branchId: { productId: 30, branchId: 7 } },
    data: { quantity: { decrement: 2 } },
  });
});

test('claim creation persists initial event with claim data', async () => {
  const client = createClient();
  const repository = new RepairRepository(client);
  const data = { branchId: 7, claimNo: 'WC-1' };
  const initialEvent = { status: 'DRAFT', note: 'Opened' };

  await repository.createWarrantyClaim(data, initialEvent);

  assert.deepEqual(client.calls[0].args.data, {
    ...data,
    events: { create: initialEvent },
  });
  assert.equal(client.calls[0].args.include, RepairRepository.warrantyClaimDetailInclude);
});

test('claim update writes status data and event atomically', async () => {
  const client = createClient();
  const repository = new RepairRepository(client);
  const data = { status: 'SUBMITTED' };
  const event = { status: 'SUBMITTED', note: 'Sent' };

  await repository.updateWarrantyClaim('50', data, event);

  assert.deepEqual(client.calls[0].args, {
    where: { id: 50 },
    data: { ...data, events: { create: event } },
    include: RepairRepository.warrantyClaimDetailInclude,
  });
});

test('transaction supplies a repository bound to transaction client', async () => {
  let transactionRepository;
  const txClient = createClient();
  const client = createClient();
  client.$transaction = async (work) => work(txClient);
  const repository = new RepairRepository(client);

  await repository.transaction(async (txRepository) => {
    transactionRepository = txRepository;
    await txRepository.findCustomer(20);
  });

  assert.ok(transactionRepository instanceof RepairRepository);
  assert.equal(transactionRepository.prisma, txClient);
  assert.equal(txClient.calls[0].model, 'customerProfile');
});
