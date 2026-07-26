const test = require('node:test');
const assert = require('node:assert/strict');
const { CustomerWarrantyAssetService } = require('./customerWarrantyAssetService');

const actor = { branchId: 7 };

function product(overrides = {}) {
  return {
    id: 10,
    name: 'Notebook',
    warrantyDays: 365,
    brand: { name: 'Alpha' },
    productType: { id: 3, name: 'Notebook' },
    ...overrides,
  };
}

test('validates customer id before repository access', async () => {
  let called = false;
  const service = new CustomerWarrantyAssetService({
    async findCustomer() { called = true; },
  });

  await assert.rejects(() => service.listForCustomer(actor, '0'), {
    code: 'REPAIR_INVALID_INPUT',
    status: 'fail',
  });
  assert.equal(called, false);
});

test('returns customer-not-found failure before loading warranty assets', async () => {
  let assetCalls = 0;
  const service = new CustomerWarrantyAssetService({
    async findCustomer() { return null; },
    async findCustomerWarrantyStockItems() { assetCalls += 1; },
    async findCustomerWarrantySimpleItems() { assetCalls += 1; },
  });

  await assert.rejects(() => service.listForCustomer(actor, 20), {
    code: 'REPAIR_CUSTOMER_NOT_FOUND',
    status: 'fail',
  });
  assert.equal(assetCalls, 0);
});

test('loads structured and simple assets with branch and customer scope', async () => {
  const calls = [];
  const service = new CustomerWarrantyAssetService({
    async findCustomer(id) {
      assert.equal(id, 20);
      return { id };
    },
    async findCustomerWarrantyStockItems(branchId, customerId) {
      calls.push(['stock', branchId, customerId]);
      return [{
        id: 1,
        barcode: 'AT-1',
        serialNumber: 'SN-1',
        soldAt: '2026-07-01T00:00:00.000Z',
        warrantyDays: 365,
        expiredAt: '2099-01-01T00:00:00.000Z',
        product: product(),
        saleItems: [{
          price: 20000,
          discount: 500,
          sale: {
            id: 100,
            code: 'S-100',
            soldAt: '2026-07-01T00:00:00.000Z',
            customerId: 20,
            branchId: 7,
          },
        }],
      }];
    },
    async findCustomerWarrantySimpleItems(branchId, customerId) {
      calls.push(['simple', branchId, customerId]);
      return [{
        id: 2,
        quantity: 2,
        price: 800,
        discount: 0,
        product: product({ id: 11, name: 'Mouse', warrantyDays: 30 }),
        sale: {
          id: 101,
          code: 'S-101',
          soldAt: '2026-07-15T00:00:00.000Z',
          customerId: 20,
          branchId: 7,
        },
      }];
    },
  });

  const result = await service.listForCustomer(actor, '20');

  assert.deepEqual(calls, [['stock', 7, 20], ['simple', 7, 20]]);
  assert.equal(result.length, 2);
  assert.equal(result[0].assetType, 'SIMPLE_PRODUCT');
  assert.equal(result[0].id, 'simple:2');
  assert.equal(result[0].stockItemId, null);
  assert.equal(result[0].quantity, 2);
  assert.equal(result[0].warranty.policySource, 'PRODUCT');
  assert.equal(result[1].assetType, 'STOCK_ITEM');
  assert.equal(result[1].id, 'stock:1');
  assert.equal(result[1].stockItem.barcode, 'AT-1');
  assert.equal(result[1].warranty.policySource, 'STOCK_ITEM');
});

test('prefers explicit expiry when warranty days are unavailable', async () => {
  const service = new CustomerWarrantyAssetService({
    async findCustomer() { return { id: 20 }; },
    async findCustomerWarrantyStockItems() {
      return [{
        id: 1,
        barcode: 'AT-1',
        serialNumber: null,
        soldAt: null,
        warrantyDays: null,
        expiredAt: '2099-01-01T00:00:00.000Z',
        product: product({ warrantyDays: null }),
        saleItems: [],
      }];
    },
    async findCustomerWarrantySimpleItems() { return []; },
  });

  const [asset] = await service.listForCustomer(actor, 20);
  assert.equal(asset.warranty.hasPolicy, true);
  assert.equal(asset.warranty.policySource, 'EXPLICIT_EXPIRY');
  assert.equal(asset.warranty.active, true);
  assert.equal(asset.latestSale, null);
});

test('maps product identity consistently for simple products', async () => {
  const service = new CustomerWarrantyAssetService({
    async findCustomer() { return { id: 20 }; },
    async findCustomerWarrantyStockItems() { return []; },
    async findCustomerWarrantySimpleItems() {
      return [{
        id: 2,
        quantity: 1,
        price: 100,
        discount: 10,
        product: product(),
        sale: null,
      }];
    },
  });

  const [asset] = await service.listForCustomer(actor, 20);
  assert.deepEqual(asset.product, {
    id: 10,
    name: 'Notebook',
    warrantyDays: 365,
    brand: 'Alpha',
    model: 'Notebook',
    productType: { id: 3, name: 'Notebook' },
  });
  assert.equal(asset.identity.product, asset.product);
  assert.equal(asset.latestSale, null);
});