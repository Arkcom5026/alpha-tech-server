const test = require('node:test');
const assert = require('node:assert/strict');
const { GetRepairPartStockOptionsService } = require('./getRepairPartStockOptionsService');
const { RepairFailureCode } = require('../../contracts/repairError');

function repairingJob(overrides = {}) {
  return { id: 31, branchId: 7, jobNo: 'RP-31', deviceId: 88, warrantyClaims: [], ...overrides };
}

function repairingEvent() {
  return Promise.resolve({ metadata: { workflowTargetStatus: 'REPAIRING' } });
}

test('returns only IN_STOCK serialized inventory options for the actor branch', async () => {
  const calls = {};
  const service = new GetRepairPartStockOptionsService({
    findRepairJob(branchId, repairJobId) {
      calls.job = { branchId, repairJobId };
      return Promise.resolve(repairingJob());
    },
    findLatestWorkflowEvent(branchId, repairJobId, deviceId) {
      calls.workflow = { branchId, repairJobId, deviceId };
      return repairingEvent();
    },
    findProduct(productId) {
      calls.productId = productId;
      return Promise.resolve({
        id: 12,
        name: 'SSD 1TB',
        active: true,
        branchId: 7,
        trackSerialNumber: true,
        inventoryBehavior: 'TRACKED',
      });
    },
    findAvailableStockItems(branchId, productId, query) {
      calls.options = { branchId, productId, query };
      return Promise.resolve([
        { id: 90, barcode: 'BC90', serialNumber: 'SN90', status: 'IN_STOCK', costPrice: '250' },
      ]);
    },
  });

  const result = await service.execute({ branchId: 7 }, '31', { productId: '12', q: 'SN90' });
  assert.equal(result.mode, 'SERIALIZED');
  assert.equal(result.items[0].serialNumber, 'SN90');
  assert.equal(result.items[0].costPrice, 250);
  assert.deepEqual(calls.workflow, { branchId: 7, repairJobId: 31, deviceId: 88 });
  assert.deepEqual(calls.options, { branchId: 7, productId: 12, query: 'SN90' });
});

test('quantity products do not expose StockItem choices', async () => {
  let searched = false;
  const service = new GetRepairPartStockOptionsService({
    findRepairJob: () => Promise.resolve(repairingJob()),
    findLatestWorkflowEvent: repairingEvent,
    findProduct: () => Promise.resolve({
      id: 12,
      name: 'Cleaning fluid',
      active: true,
      branchId: 7,
      trackSerialNumber: false,
      inventoryBehavior: 'TRACKED',
    }),
    findAvailableStockItems() {
      searched = true;
      return Promise.resolve([]);
    },
  });

  const result = await service.execute({ branchId: 7 }, 31, { productId: 12 });
  assert.equal(result.mode, 'QUANTITY');
  assert.deepEqual(result.items, []);
  assert.equal(searched, false);
});

test('rejects non-stock or cross-branch part products', async () => {
  for (const product of [
    { id: 12, active: true, branchId: 8, trackSerialNumber: true, inventoryBehavior: 'TRACKED' },
    { id: 12, active: true, branchId: 7, trackSerialNumber: true, inventoryBehavior: 'NON_STOCK' },
  ]) {
    const service = new GetRepairPartStockOptionsService({
      findRepairJob: () => Promise.resolve(repairingJob()),
      findLatestWorkflowEvent: repairingEvent,
      findProduct: () => Promise.resolve(product),
    });
    await assert.rejects(
      () => service.execute({ branchId: 7 }, 31, { productId: 12 }),
      (error) => [RepairFailureCode.PART_PRODUCT_NOT_FOUND, RepairFailureCode.CONFLICT].includes(error.code)
    );
  }
});

test('blocks stock option discovery outside REPAIRING and during an active claim', async () => {
  const waitingService = new GetRepairPartStockOptionsService({
    findRepairJob: () => Promise.resolve(repairingJob()),
    findLatestWorkflowEvent: () => Promise.resolve({ metadata: { workflowTargetStatus: 'WAITING_PARTS' } }),
  });
  await assert.rejects(
    () => waitingService.execute({ branchId: 7 }, 31, { productId: 12 }),
    (error) => {
      assert.equal(error.code, RepairFailureCode.CONFLICT);
      assert.deepEqual(error.details, { workflowStatus: 'WAITING_PARTS', requiredWorkflowStatus: 'REPAIRING' });
      return true;
    }
  );

  const claimService = new GetRepairPartStockOptionsService({
    findRepairJob: () => Promise.resolve(repairingJob({
      warrantyClaims: [{ id: 44, claimNo: 'WC-44', status: 'INSPECTING' }],
    })),
  });
  await assert.rejects(
    () => claimService.execute({ branchId: 7 }, 31, { productId: 12 }),
    (error) => {
      assert.equal(error.code, RepairFailureCode.CONFLICT);
      assert.equal(error.details.warrantyClaimId, 44);
      return true;
    }
  );
});
