const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MIN_TEXT_QUERY_LENGTH,
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

const simpleProduct = {
  id: 3129,
  name: 'Simple Product 3129',
  active: true,
  mode: 'SIMPLE',
  saleBarcode: 'SIMPLE-3129',
  codeType: 'SP-3129',
  branchPrice,
  brand: { id: 1, name: 'Alpha' },
  productType: { id: 2, name: 'Accessory' },
};

const structuredProduct = {
  ...simpleProduct,
  id: 99,
  name: 'Acer Aspire A315',
  mode: 'STRUCTURED',
  saleBarcode: 'ACER-A315',
  codeType: 'A315',
};

const emptyRepository = (overrides = {}) => ({
  findExactStockItems: async () => [],
  findExactSimpleLots: async () => [],
  findTextStockItems: async () => [],
  findTextSimpleLots: async () => [],
  ...overrides,
});

test('exact SimpleLot barcode match is auto-selectable with quantity evidence', async () => {
  const repository = emptyRepository({
    findExactSimpleLots: async () => [{
      id: 3,
      branchId: 1,
      productId: 3129,
      barcode: '888888',
      qtyRemaining: 9998,
      status: 'ACTIVE',
      product: simpleProduct,
    }],
  });

  const result = await searchSaleItems({ branchId: 1, query: '888888', repository });

  assert.equal(result.matchMode, 'IDENTIFIER');
  assert.equal(result.autoSelect, true);
  assert.equal(result.total, 1);
  assert.equal(result.items[0].matchReason, 'BARCODE_EXACT');
  assert.equal(result.items[0].simpleLotId, 3);
  assert.equal(result.items[0].quantityAvailable, 9998);
  assert.equal(result.items[0].product.brandName, 'Alpha');
});

test('exact StockItem serial number match is auto-selectable', async () => {
  const repository = emptyRepository({
    findExactStockItems: async () => [{
      id: 421,
      branchId: 1,
      productId: 99,
      barcode: 'STOCK-421',
      serialNumber: 'AD1000-3241206829',
      status: 'IN_STOCK',
      product: structuredProduct,
    }],
  });

  const result = await searchSaleItems({
    branchId: 1,
    query: 'ad1000-3241206829',
    repository,
  });

  assert.equal(result.matchMode, 'IDENTIFIER');
  assert.equal(result.autoSelect, true);
  assert.equal(result.items[0].matchReason, 'SERIAL_EXACT');
  assert.equal(result.items[0].stockItemId, 421);
  assert.equal(result.items[0].serialNumber, 'AD1000-3241206829');
});

test('multiple exact identifier matches require user selection', async () => {
  const repository = emptyRepository({
    findExactStockItems: async () => [
      {
        id: 421,
        productId: 99,
        barcode: 'SHARED-CODE',
        serialNumber: 'SN-421',
        status: 'IN_STOCK',
        product: structuredProduct,
      },
      {
        id: 422,
        productId: 99,
        barcode: 'SHARED-CODE',
        serialNumber: 'SN-422',
        status: 'IN_STOCK',
        product: structuredProduct,
      },
    ],
  });

  const result = await searchSaleItems({ branchId: 1, query: 'SHARED-CODE', repository });

  assert.equal(result.matchMode, 'IDENTIFIER');
  assert.equal(result.autoSelect, false);
  assert.equal(result.total, 2);
});

test('name and model search requires at least three characters after exact lookup', async () => {
  const repository = emptyRepository();

  await assert.rejects(
    () => searchSaleItems({ branchId: 1, query: 'ac', repository }),
    {
      code: 'SALE_ITEM_TEXT_QUERY_TOO_SHORT',
      status: 400,
      details: { minLength: MIN_TEXT_QUERY_LENGTH },
    },
  );
});

test('multi-token text search returns selectable stock and simple results', async () => {
  let capturedStockTerms = null;
  let capturedSimpleTerms = null;
  const repository = emptyRepository({
    findTextStockItems: async ({ terms }) => {
      capturedStockTerms = terms;
      return [{
        id: 421,
        productId: 99,
        barcode: 'STOCK-421',
        serialNumber: 'SN-421',
        status: 'IN_STOCK',
        product: structuredProduct,
      }];
    },
    findTextSimpleLots: async ({ terms }) => {
      capturedSimpleTerms = terms;
      return [{
        id: 3,
        productId: 3129,
        barcode: 'SIMPLE-LOT-3',
        qtyRemaining: 8,
        status: 'ACTIVE',
        product: simpleProduct,
      }];
    },
  });

  const result = await searchSaleItems({ branchId: 1, query: 'Acer A315', repository });

  assert.deepEqual(capturedStockTerms, ['Acer', 'A315']);
  assert.deepEqual(capturedSimpleTerms, ['Acer', 'A315']);
  assert.equal(result.matchMode, 'TEXT');
  assert.equal(result.autoSelect, false);
  assert.equal(result.total, 2);
  assert.deepEqual(result.items.map((item) => item.type), ['STOCK', 'SIMPLE']);
});

test('no search result is a normal empty search response', async () => {
  const result = await searchSaleItems({
    branchId: 2,
    query: 'not-found',
    repository: emptyRepository(),
  });

  assert.equal(result.matchMode, 'TEXT');
  assert.equal(result.autoSelect, false);
  assert.equal(result.total, 0);
  assert.deepEqual(result.items, []);
});

test('exact identifier found but unavailable returns a conflict', async () => {
  const repository = emptyRepository({
    findExactStockItems: async () => [{
      id: 421,
      productId: 99,
      barcode: 'STOCK-421',
      serialNumber: 'SN-421',
      status: 'SOLD',
      product: structuredProduct,
    }],
  });

  await assert.rejects(
    () => searchSaleItems({ branchId: 1, query: 'SN-421', repository }),
    { code: 'SALE_ITEM_NOT_SELLABLE', status: 409 },
  );
});

test('POS search keeps available in-store prices when online price is unset', async () => {
  const repository = emptyRepository({
    findExactStockItems: async () => [{
      id: 422,
      productId: 99,
      barcode: 'STOCK-422',
      serialNumber: 'SN-422',
      status: 'IN_STOCK',
      product: {
        ...structuredProduct,
        branchPrice: [{
          priceRetail: 107,
          priceWholesale: 107,
          priceTechnician: 107,
          priceOnline: null,
        }],
      },
    }],
  });

  const result = await searchSaleItems({ branchId: 1, query: 'STOCK-422', repository });

  assert.deepEqual(result.items[0].prices, {
    retail: 107,
    wholesale: 107,
    technician: 107,
    online: null,
  });
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
