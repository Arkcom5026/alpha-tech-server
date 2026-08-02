const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ListRepairJobsRepository,
} = require('./listRepairJobsRepository');
const {
  ListRepairJobsService,
  validateListQuery,
} = require('./listRepairJobsService');

function jobFixture(overrides = {}) {
  return {
    id: 12,
    jobNo: 'RP-12',
    branchId: 4,
    customerId: 8,
    customer: { name: 'Customer A' },
    stockItemId: null,
    stockItem: null,
    deviceModel: 'Notebook',
    reportedSymptoms: 'No power',
    technicianNotes: null,
    status: 'RECEIVED',
    estimatedCost: 500,
    depositPaid: 100,
    technician: null,
    technicianId: null,
    deviceIntake: null,
    delivery: null,
    partsUsed: [],
    warrantyClaims: [],
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
    ...overrides,
  };
}

test('list jobs repository always scopes by branch and normalized filters', async () => {
  let received;
  const repository = new ListRepairJobsRepository({
    repairJob: {
      findMany(args) {
        received = args;
        return Promise.resolve([]);
      },
    },
  });

  await repository.findMany(4, {
    status: 'RECEIVED',
    stockItemId: 10,
    customerId: 8,
    limit: 25,
    offset: 5,
  });

  assert.deepEqual(received.where, {
    branchId: 4,
    status: 'RECEIVED',
    stockItemId: 10,
    customerId: 8,
  });
  assert.equal(received.take, 25);
  assert.equal(received.skip, 5);
  assert.deepEqual(received.orderBy, { createdAt: 'desc' });
  assert.ok(received.include.deviceIntake);
  assert.equal(received.include.delivery, true);
});

test('list jobs validation normalizes and clamps query values', () => {
  assert.deepEqual(
    validateListQuery({
      status: ' received ',
      stockItemId: '10',
      customerId: '8',
      limit: '999',
      offset: '-5',
    }),
    {
      status: 'RECEIVED',
      stockItemId: 10,
      customerId: 8,
      limit: 100,
      offset: 0,
    }
  );
});

test('list jobs service returns mapped items and server-owned operational summary', async () => {
  let received;
  const service = new ListRepairJobsService({
    findMany(branchId, filters) {
      received = { branchId, filters };
      return Promise.resolve([jobFixture()]);
    },
  });

  const result = await service.execute(
    { branchId: 4 },
    { status: 'received', limit: '20' }
  );

  assert.equal(received.branchId, 4);
  assert.equal(received.filters.status, 'RECEIVED');
  assert.equal(received.filters.limit, 20);
  assert.equal(result.items[0].id, 12);
  assert.equal(result.items[0].customerName, 'Customer A');
  assert.equal(result.items[0].estimatedCost, 500);
  assert.ok(result.items[0].operational);
  assert.equal(result.summary.total, 1);
  assert.equal(result.summary.active, 1);
  assert.equal(result.summary.unassigned, 1);
});
