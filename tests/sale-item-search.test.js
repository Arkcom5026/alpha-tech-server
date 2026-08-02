const test = require('node:test');
const assert = require('node:assert/strict');

const {
  searchSaleItems,
} = require('../src/modules/sales/item-search/services/saleItemSearchService');
const {
  parseCompleteSaleCommand,
} = require('../src/modules/sales/completion/contracts/saleCompletionContract');

const branchPrice = [{
  priceRetail: 100,
  priceWholesale: 90,
  priceTechnician: 95,
  priceOnline: 110,
}];

const product = {
  id: 3129,
  name: 'Simple Product 3129',
  active: true,
  mode: 'SIMPLE',
  branchPrice,
};

test('unified barcode search returns ACTIVE SimpleLot with quantity evidence', async () => {
  const repository = {
    findStockItemByBarcode: async () => null,
    findSimpleLotByBarcode: async () => ({
      id: 3,
      branchId: 1,
      productId: 3129,
      barcode: '888888',
      qtyRemaining: 9998,
      status: 'ACTIVE',
      product,
    }),
  };

  const result = await searchSaleItems({ branchId: 1, query: '888888', repository });
  assert.deepEqual(result.items[0], {
    type: 'SIMPLE',
    lineType: 'SIMPLE',
    productId: 3129,
    stockItemId: null,
    simpleLotId: 3,
    barcode: '888888',
    quantityAvailable: 9998,
    qtyRemaining: 9998,
    status: 'ACTIVE',
    product,
    prices: {
      retail: 100,
      wholesale: 90,
      technician: 95,
      online: 110,
    },
  });
});

test('unified barcode search preserves existing StockItem behavior and precedence', async () => {
  let simpleLookupCalled = false;
  const stockProduct = { ...product, id: 99, mode: 'STRUCTURED' };
  const repository = {
    findStockItemByBarcode: async () => ({
      id: 421,
      productId: 99,
      barcode: 'STOCK-421',
      status: 'IN_STOCK',
      product: stockProduct,
    }),
    findSimpleLotByBarcode: async () => {
      simpleLookupCalled = true;
      return null;
    },
  };

  const result = await searchSaleItems({ branchId: 1, query: 'STOCK-421', repository });
  assert.equal(result.items[0].type, 'STOCK');
  assert.equal(result.items[0].stockItemId, 421);
  assert.equal(result.items[0].simpleLotId, null);
  assert.equal(simpleLookupCalled, false);
});

test('unified barcode search rejects inactive or empty SimpleLot', async () => {
  const inactiveRepository = {
    findStockItemByBarcode: async () => null,
    findSimpleLotByBarcode: async () => ({
      id: 3,
      productId: 3129,
      barcode: '888888',
      qtyRemaining: 9998,
      status: 'INACTIVE',
      product,
    }),
  };
  await assert.rejects(
    () => searchSaleItems({ branchId: 1, query: '888888', repository: inactiveRepository }),
    { code: 'SIMPLE_LOT_NOT_ACTIVE' }
  );

  const emptyRepository = {
    findStockItemByBarcode: async () => null,
    findSimpleLotByBarcode: async () => ({
      id: 3,
      productId: 3129,
      barcode: '888888',
      qtyRemaining: 0,
      status: 'ACTIVE',
      product,
    }),
  };
  await assert.rejects(
    () => searchSaleItems({ branchId: 1, query: '888888', repository: emptyRepository }),
    { code: 'SIMPLE_LOT_EMPTY' }
  );
});

test('sale completion contract preserves simpleLotId and never uses barcode as FK', () => {
  const command = parseCompleteSaleCommand({
    commandId: 'simple-sale-command-0001',
    sale: {
      customerId: null,
      totalBeforeDiscount: 100,
      totalDiscount: 0,
      vat: 6.54,
      vatRate: 7,
      totalAmount: 100,
      mode: 'CASH',
      lines: [{
        lineId: 'simple-3',
        lineType: 'SIMPLE',
        productId: 3129,
        simpleLotId: 3,
        quantity: 1,
        basePrice: 100,
        discount: 0,
        price: 100,
        vatAmount: 6.54,
        barcode: '888888',
      }],
    },
    payment: {
      paymentItems: [{ paymentMethod: 'CASH', amount: 100 }],
    },
  });

  assert.equal(command.sale.items[0].lineType, 'SIMPLE');
  assert.equal(command.sale.items[0].simpleLotId, 3);
  assert.equal(command.sale.items[0].productId, 3129);
  assert.equal(command.sale.items[0].stockItemId, null);
  assert.equal(Object.hasOwn(command.sale.items[0], 'barcode'), false);
});

test('POS barcode search keeps available in-store prices when online price is unset', async () => {
  const repository = {
    findStockItemByBarcode: async () => ({
      id: 422,
      productId: 99,
      barcode: 'STOCK-422',
      status: 'IN_STOCK',
      product: {
        ...product,
        id: 99,
        mode: 'STRUCTURED',
        branchPrice: [{
          priceRetail: 107,
          priceWholesale: 107,
          priceTechnician: 107,
          priceOnline: null,
        }],
      },
    }),
    findSimpleLotByBarcode: async () => null,
  };

  const result = await searchSaleItems({ branchId: 1, query: 'STOCK-422', repository });

  assert.deepEqual(result.items[0].prices, {
    retail: 107,
    wholesale: 107,
    technician: 107,
    online: null,
  });
});
