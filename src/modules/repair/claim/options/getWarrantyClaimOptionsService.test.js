const test = require('node:test');
const assert = require('node:assert/strict');
const { GetWarrantyClaimOptionsService } = require('./getWarrantyClaimOptionsService');

function eligibleJob(overrides = {}) {
  return {
    id: 41,
    status: 'IN_PROGRESS',
    stockItemId: 18,
    deviceId: 55,
    warrantyClaims: [],
    stockItem: {
      purchaseOrderReceiptItem: {
        receipt: {
          supplierId: 9,
          supplier: { id: 9, name: 'Supplier A', phone: '02', email: 'a@example.com' },
        },
      },
    },
    ...overrides,
  };
}

test('locks supplier choice to the source supplier when purchase history exists', async () => {
  let listed = false;
  const service = new GetWarrantyClaimOptionsService({
    findRepairJob(branchId, repairJobId) {
      assert.equal(branchId, 3);
      assert.equal(repairJobId, 41);
      return Promise.resolve(eligibleJob());
    },
    listActiveSuppliers() {
      listed = true;
      return Promise.resolve([]);
    },
  });

  const result = await service.execute({ branchId: 3 }, 41);
  assert.equal(result.supplierSelectionMode, 'SOURCE_LOCKED');
  assert.equal(result.sourceSupplierId, 9);
  assert.equal(result.suppliers.length, 1);
  assert.equal(result.suppliers[0].name, 'Supplier A');
  assert.equal(result.suppliers[0].sourceMatched, true);
  assert.equal(listed, false);
});

test('offers only active branch supplier options when there is no source supplier', async () => {
  const service = new GetWarrantyClaimOptionsService({
    findRepairJob() {
      return Promise.resolve(eligibleJob({
        stockItem: null,
        stockItemId: null,
        deviceId: 55,
      }));
    },
    listActiveSuppliers(branchId) {
      assert.equal(branchId, 3);
      return Promise.resolve([
        { id: 4, name: 'Service Partner', phone: null, email: null },
      ]);
    },
  });

  const result = await service.execute({ branchId: 3 }, 41);
  assert.equal(result.supplierSelectionMode, 'BRANCH_SELECTABLE');
  assert.equal(result.sourceSupplierId, null);
  assert.equal(result.suppliers[0].id, 4);
  assert.equal(result.suppliers[0].sourceMatched, false);
});

test('rejects an invalid repair job id before repository access', async () => {
  let called = false;
  const service = new GetWarrantyClaimOptionsService({
    findRepairJob() { called = true; },
  });

  await assert.rejects(
    () => service.execute({ branchId: 3 }, 'bad'),
    (error) => error.code === 'REPAIR_INVALID_INPUT' && error.details.field === 'repairJobId'
  );
  assert.equal(called, false);
});
