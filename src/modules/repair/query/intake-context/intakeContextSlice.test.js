const test = require('node:test');
const assert = require('node:assert/strict');

const {
  IntakeContextRepository,
} = require('./intakeContextRepository');
const {
  IntakeContextService,
} = require('./intakeContextService');
const {
  RepairFailureCode,
} = require('../../contracts/repairError');

test('slice repository scopes lookup by branch and supports numeric identity', async () => {
  let received;
  const client = {
    stockItem: {
      findFirst(args) {
        received = args;
        return Promise.resolve(null);
      },
    },
  };

  const repository = new IntakeContextRepository(client);
  await repository.findByLookup('7', '123');

  assert.equal(received.where.branchId, 7);
  assert.deepEqual(received.where.OR, [
    { barcode: '123' },
    { serialNumber: '123' },
    { id: 123 },
  ]);
  assert.ok(received.include.product);
  assert.ok(received.include.repairJobs);
  assert.ok(received.include.warrantyClaims);
});

test('slice repository omits invalid numeric identity clause', async () => {
  let received;
  const client = {
    stockItem: {
      findFirst(args) {
        received = args;
        return Promise.resolve(null);
      },
    },
  };

  const repository = new IntakeContextRepository(client);
  await repository.findByLookup(4, 'SN-001');

  assert.deepEqual(received.where.OR, [
    { barcode: 'SN-001' },
    { serialNumber: 'SN-001' },
  ]);
});

test('slice service calls slice repository and maps intake context', async () => {
  const stockItem = {
    id: 11,
    barcode: 'BC-11',
    serialNumber: 'SN-11',
    branchId: 3,
    product: { id: 9, name: 'Notebook' },
    saleItems: [],
    repairJobs: [],
    warrantyClaims: [],
  };
  let received;
  const repository = {
    findByLookup(branchId, lookup) {
      received = { branchId, lookup };
      return Promise.resolve(stockItem);
    },
  };

  const service = new IntakeContextService(repository);
  const result = await service.execute({ branchId: 3 }, '  BC-11  ');

  assert.deepEqual(received, { branchId: 3, lookup: 'BC-11' });
  assert.equal(result.stockItem.id, 11);
  assert.equal(result.stockItem.barcode, 'BC-11');
});

test('slice service preserves domain not-found contract', async () => {
  const service = new IntakeContextService({
    findByLookup() {
      return Promise.resolve(null);
    },
  });

  await assert.rejects(
    () => service.execute({ branchId: 8 }, 'UNKNOWN'),
    (error) => {
      assert.equal(error.code, RepairFailureCode.STOCK_ITEM_NOT_FOUND);
      assert.equal(error.statusCode, 404);
      assert.deepEqual(error.details, { lookup: 'UNKNOWN' });
      return true;
    }
  );
});
