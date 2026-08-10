const test = require('node:test');
const assert = require('node:assert/strict');
const { GetRepairPartStockOptionsService } = require('./getRepairPartStockOptionsService');
const { RepairFailureCode } = require('../../contracts/repairError');

test('returns only IN_STOCK serialized inventory options for the actor branch', async () => {
  const calls = {};
  const service = new GetRepairPartStockOptionsService({
    findRepairJob(branchId, repairJobId) {
      calls.job = { branchId, repairJobId };
      return Promise.resolve({ id: 31, branchId: 7, jobNo: 'RP-31' });
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
  assert.deepEqual(calls.options, { branchId: 7, productId: 12, query: 'SN90' });
});

test('quantity products do not expose StockItem choices', async () => {
  let searched = false;
  const service = new GetRepairPartStockOptionsService({
    findRepairJob: () => Promise.resolve({ id: 31, branchId: 7 }),
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
      findRepairJob: () => Promise.resolve({ id: 31, branchId: 7 }),
      findProduct: () => Promise.resolve(product),
    });
    await assert.rejects(
      () => service.execute({ branchId: 7 }, 31, { productId: 12 }),
      (error) => [RepairFailureCode.PART_PRODUCT_NOT_FOUND, RepairFailureCode.CONFLICT].includes(error.code)
    );
  }
});
