const test = require('node:test');
const assert = require('node:assert/strict');
const { RepairIntakeService } = require('./repairIntakeService');

function createStockItem(overrides = {}) {
  return {
    id: 1,
    barcode: 'AT-001',
    serialNumber: 'SN-001',
    status: 'SOLD',
    warrantyDays: 365,
    soldAt: '2026-01-01T00:00:00.000Z',
    expiredAt: '2099-01-01T00:00:00.000Z',
    branchId: 7,
    product: {
      id: 2,
      name: 'Notebook',
      warrantyDays: 365,
      brand: { name: 'Alpha' },
      productType: { name: 'Notebook' },
    },
    saleItems: [],
    repairJobs: [],
    warrantyClaims: [],
    purchaseOrderReceiptItem: null,
    ...overrides,
  };
}

test('normalizes lookup, scopes repository lookup by branch, and maps intake context', async () => {
  const calls = [];
  const repository = {
    async findStockItemForIntake(branchId, lookup) {
      calls.push({ branchId, lookup });
      return createStockItem();
    },
  };
  const service = new RepairIntakeService(repository);

  const result = await service.getContext({ branchId: 7 }, '  AT-001  ');

  assert.deepEqual(calls, [{ branchId: 7, lookup: 'AT-001' }]);
  assert.equal(result.identity.id, 1);
  assert.equal(result.recommendedActions[0].type, 'CREATE_REPAIR_JOB');
});

test('rejects invalid lookup before calling repository', async () => {
  let called = false;
  const service = new RepairIntakeService({
    async findStockItemForIntake() {
      called = true;
      return null;
    },
  });

  await assert.rejects(() => service.getContext({ branchId: 7 }, '   '), {
    code: 'REPAIR_INVALID_LOOKUP',
    status: 'fail',
  });
  assert.equal(called, false);
});

test('returns branch-safe not-found failure with normalized lookup details', async () => {
  const service = new RepairIntakeService({
    async findStockItemForIntake() {
      return null;
    },
  });

  await assert.rejects(
    () => service.getContext({ branchId: 7 }, ' SN-404 '),
    (error) => {
      assert.equal(error.code, 'REPAIR_STOCK_ITEM_NOT_FOUND');
      assert.equal(error.status, 'fail');
      assert.deepEqual(error.details, { lookup: 'SN-404' });
      return true;
    }
  );
});