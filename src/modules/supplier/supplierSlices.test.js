const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ListSuppliersService,
  ListSuppliersRepository,
} = require('./query/list/listSuppliersSlice');
const { GetSupplierService } = require('./query/detail/getSupplierSlice');
const { CreateSupplierService } = require('./create/createSupplierSlice');
const { UpdateSupplierService } = require('./update/updateSupplierSlice');
const { DeleteSupplierService } = require('./delete/deleteSupplierSlice');

const decimalLike = (value) => ({
  toNumber: () => value,
  minus: (other) => decimalLike(value - Number(other?.toNumber ? other.toNumber() : other)),
});

test('list repository preserves branch scope, system visibility and search projection', async () => {
  let received;
  const repository = new ListSuppliersRepository({
    supplier: {
      findMany: async (query) => {
        received = query;
        return [];
      },
    },
  });

  await repository.findMany(7, { q: 'alpha' });
  assert.equal(received.where.branchId, 7);
  assert.equal(received.where.isSystem, false);
  assert.equal(received.where.OR.length, 4);
  assert.deepEqual(received.orderBy, { name: 'asc' });
});

test('list service maps decimal credit values and remaining credit', async () => {
  const service = new ListSuppliersService({
    findMany: async () => [{ id: 1, creditLimit: decimalLike(1000), creditBalance: decimalLike(250) }],
  });
  const [supplier] = await service.execute(1, {});
  assert.equal(supplier.creditLimit, 1000);
  assert.equal(supplier.creditBalance, 250);
  assert.equal(supplier.creditRemaining, 750);
});

test('detail service keeps branch-safe not-found semantics', async () => {
  const missing = new GetSupplierService({ findById: async () => null });
  assert.equal(await missing.execute(1, 99), null);
});

test('create service delegates branch-owned supplier creation', async () => {
  let received;
  const service = new CreateSupplierService({
    create: async (branchId, input) => {
      received = { branchId, input };
      return { id: 5 };
    },
  });
  assert.deepEqual(await service.execute(3, { name: 'Supplier', phone: '123' }), { id: 5 });
  assert.equal(received.branchId, 3);
});

test('update service blocks missing and system suppliers', async () => {
  const missing = new UpdateSupplierService({ findById: async () => null });
  assert.equal((await missing.execute(1, 2, {})).failure, 'NOT_FOUND');

  const system = new UpdateSupplierService({ findById: async () => ({ isSystem: true }) });
  assert.equal((await system.execute(1, 2, {})).failure, 'SYSTEM_SUPPLIER');
});

test('update service whitelists fields before persistence', async () => {
  let data;
  const service = new UpdateSupplierService({
    findById: async () => ({ isSystem: false }),
    update: async (_id, input) => {
      data = input;
      return { id: 2 };
    },
  });
  await service.execute(1, 2, { name: 'Updated', branchId: 999, isSystem: true });
  assert.deepEqual(data, { name: 'Updated' });
});

test('delete service protects system and referenced suppliers', async () => {
  const system = new DeleteSupplierService({ findById: async () => ({ isSystem: true }) });
  assert.equal((await system.execute(1, 2)).failure, 'SYSTEM_SUPPLIER');

  const referenced = new DeleteSupplierService({
    findById: async () => ({ isSystem: false }),
    countPurchaseOrders: async () => 1,
  });
  assert.equal((await referenced.execute(1, 2)).failure, 'REFERENCED');
});

test('delete service removes unreferenced branch-owned supplier', async () => {
  let deletedId;
  const service = new DeleteSupplierService({
    findById: async () => ({ isSystem: false }),
    countPurchaseOrders: async () => 0,
    delete: async (id) => { deletedId = id; },
  });
  assert.deepEqual(await service.execute(1, 8), { deleted: true });
  assert.equal(deletedId, 8);
});
