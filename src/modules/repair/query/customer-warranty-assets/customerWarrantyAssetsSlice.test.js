const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CustomerWarrantyAssetsRepository,
} = require('./customerWarrantyAssetsRepository');
const {
  CustomerWarrantyAssetsService,
} = require('./customerWarrantyAssetsService');
const {
  RepairFailureCode,
} = require('../../contracts/repairError');

test('slice repository keeps structured asset lookup branch-safe and customer-safe', async () => {
  let received;
  const client = {
    stockItem: {
      findMany(args) {
        received = args;
        return Promise.resolve([]);
      },
    },
  };

  const repository = new CustomerWarrantyAssetsRepository(client);
  await repository.findStructuredAssets('4', '9');

  assert.equal(received.where.branchId, 4);
  assert.equal(received.where.saleItems.some.sale.customerId, 9);
  assert.equal(received.where.saleItems.some.sale.branchId, 4);
  assert.equal(received.include.saleItems.where.sale.customerId, 9);
  assert.equal(received.include.saleItems.where.sale.branchId, 4);
});

test('slice repository keeps simple asset lookup branch-safe and customer-safe', async () => {
  let received;
  const client = {
    saleItemSimple: {
      findMany(args) {
        received = args;
        return Promise.resolve([]);
      },
    },
  };

  const repository = new CustomerWarrantyAssetsRepository(client);
  await repository.findSimpleAssets(5, 12);

  assert.equal(received.where.sale.customerId, 12);
  assert.equal(received.where.sale.branchId, 5);
  assert.deepEqual(received.where.product.warrantyDays, { gt: 0 });
});

test('slice service validates customer before loading assets', async () => {
  let assetLookupCalled = false;
  const service = new CustomerWarrantyAssetsService({
    findCustomer() {
      return Promise.resolve(null);
    },
    findStructuredAssets() {
      assetLookupCalled = true;
      return Promise.resolve([]);
    },
    findSimpleAssets() {
      assetLookupCalled = true;
      return Promise.resolve([]);
    },
  });

  await assert.rejects(
    () => service.execute({ branchId: 2 }, '7'),
    (error) => {
      assert.equal(error.code, RepairFailureCode.CUSTOMER_NOT_FOUND);
      assert.equal(error.statusCode, 404);
      assert.deepEqual(error.details, { customerId: 7 });
      return true;
    }
  );
  assert.equal(assetLookupCalled, false);
});

test('slice service maps structured and simple assets and sorts newest sale first', async () => {
  const service = new CustomerWarrantyAssetsService({
    findCustomer() {
      return Promise.resolve({ id: 7 });
    },
    findStructuredAssets(branchId, customerId) {
      assert.equal(branchId, 3);
      assert.equal(customerId, 7);
      return Promise.resolve([
        {
          id: 11,
          barcode: 'BC-11',
          serialNumber: 'SN-11',
          soldAt: new Date('2026-01-01T00:00:00.000Z'),
          warrantyDays: 365,
          expiredAt: null,
          product: {
            id: 21,
            name: 'Notebook',
            warrantyDays: 365,
            brand: { name: 'Brand A' },
            productType: { id: 31, name: 'Laptop' },
          },
          saleItems: [
            {
              price: 25000,
              discount: 500,
              sale: {
                id: 41,
                code: 'SALE-OLD',
                soldAt: new Date('2026-01-01T00:00:00.000Z'),
                customerId: 7,
                branchId: 3,
              },
            },
          ],
        },
      ]);
    },
    findSimpleAssets() {
      return Promise.resolve([
        {
          id: 12,
          quantity: 1,
          price: 1500,
          discount: 0,
          product: {
            id: 22,
            name: 'Router',
            warrantyDays: 365,
            brand: null,
            productType: { id: 32, name: 'Network' },
          },
          sale: {
            id: 42,
            code: 'SALE-NEW',
            soldAt: new Date('2026-06-01T00:00:00.000Z'),
            customerId: 7,
            branchId: 3,
          },
        },
      ]);
    },
  });

  const result = await service.execute({ branchId: 3 }, '7');

  assert.equal(result.length, 2);
  assert.equal(result[0].id, 'simple:12');
  assert.equal(result[0].assetType, 'SIMPLE_PRODUCT');
  assert.equal(result[1].id, 'stock:11');
  assert.equal(result[1].stockItem.barcode, 'BC-11');
});
