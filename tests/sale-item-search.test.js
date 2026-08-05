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
  inventoryBehavior: 'TRACKED',
  saleBarcode: 'SIMPLE-3129',
  codeType: 'SP-3129',
  branchPrice,
  brand: { id: 1, name: 'Alpha' },
  productType: { id: 2, name: 'Accessory' },
  productImages: [{ secure_url: 'https://example.test/simple.jpg' }],
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
  findBarcodeAuthorityExact: async () => null,
  findExactStockItems: async () => [],
  findExactSimpleLots: async () => [],
  findTextStockItems: async () => [],
  findTextSimpleLots: async () => [],
  findProductAvailability: async ({ productIds }) => productIds.map((productId) => ({
    productId,
    availableToSell: Number.MAX_SAFE_INTEGER,
  })),
  ...overrides,
});

test('barcode receipt authority resolves an exact StockItem and preserves authority evidence', async () => {
  const repository = emptyRepository({
    findBarcodeAuthorityExact: async () => ({
      id: 700,
      barcode: 'AD1000-3241206829',
      kind: 'SN',
      status: 'SN_RECEIVED',
      stockItem: {
        id: 421,
        branchId: 1,
        productId: 99,
        barcode: 'STOCK-421',
        serialNumber: 'SERIAL-421',
        status: 'IN_STOCK',
        product: structuredProduct,
      },
      simpleLot: null,
    }),
  });

  const result = await searchSaleItems({ branchId: 1, query: 'AD1000-3241206829', repository });

  assert.equal(result.autoSelect, true);
  assert.equal(result.items[0].stockItemId, 421);
  assert.equal(result.items[0].matchReason, 'BARCODE_AUTHORITY_EXACT');
  assert.deepEqual(result.items[0].barcodeAuthority, {
    id: 700,
    barcode: 'AD1000-3241206829',
    kind: 'SN',
    status: 'SN_RECEIVED',
  });
});

test('barcode receipt authority resolves an exact SimpleLot', async () => {
  const repository = emptyRepository({
    findBarcodeAuthorityExact: async () => ({
      id: 701,
      barcode: 'LOT-701',
      kind: 'LOT',
      status: 'READY',
      stockItem: null,
      simpleLot: {
        id: 3,
        branchId: 1,
        productId: 3129,
        barcode: 'SIMPLE-LOT-3',
        qtyRemaining: 12,
        status: 'ACTIVE',
        product: simpleProduct,
      },
    }),
  });

  const result = await searchSaleItems({ branchId: 1, query: 'LOT-701', repository });

  assert.equal(result.autoSelect, true);
  assert.equal(result.items[0].simpleLotId, 3);
  assert.equal(result.items[0].quantityAvailable, 12);
  assert.equal(result.items[0].matchReason, 'BARCODE_AUTHORITY_EXACT');
});

test('unresolved barcode receipt authority returns a conflict instead of guessing inventory', async () => {
  const repository = emptyRepository({
    findBarcodeAuthorityExact: async () => ({
      id: 702,
      barcode: 'UNRESOLVED-702',
      kind: 'SN',
      status: 'READY',
      stockItem: null,
      simpleLot: null,
    }),
  });

  await assert.rejects(
    () => searchSaleItems({ branchId: 1, query: 'UNRESOLVED-702', repository }),
    { code: 'BARCODE_AUTHORITY_UNRESOLVED', status: 409 },
  );
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
  assert.equal(result.items[0].product.coverImageUrl, 'https://example.test/simple.jpg');
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

  const result = await searchSaleItems({ branchId: 1, query: 'ad1000-3241206829', repository });

  assert.equal(result.matchMode, 'IDENTIFIER');
  assert.equal(result.autoSelect, true);
  assert.equal(result.items[0].matchReason, 'SERIAL_EXACT');
  assert.equal(result.items[0].stockItemId, 421);
});

test('duplicate authority and direct identifier match returns one inventory item', async () => {
  const stockItem = {
    id: 421,
    branchId: 1,
    productId: 99,
    barcode: 'AD1000-3241206829',
    serialNumber: 'SERIAL-421',
    status: 'IN_STOCK',
    product: structuredProduct,
  };
  const repository = emptyRepository({
    findBarcodeAuthorityExact: async () => ({
      id: 700,
      barcode: 'AD1000-3241206829',
      kind: 'SN',
      status: 'USED',
      stockItem,
      simpleLot: null,
    }),
    findExactStockItems: async () => [stockItem],
  });

  const result = await searchSaleItems({ branchId: 1, query: 'AD1000-3241206829', repository });

  assert.equal(result.total, 1);
  assert.equal(result.items[0].matchReason, 'BARCODE_AUTHORITY_EXACT');
});

test('name and model search requires at least three characters after exact lookup', async () => {
  await assert.rejects(
    () => searchSaleItems({ branchId: 1, query: 'ac', repository: emptyRepository() }),
    { code: 'SALE_ITEM_TEXT_QUERY_TOO_SHORT', status: 400, details: { minLength: MIN_TEXT_QUERY_LENGTH } },
  );
});

test('multi-token text search returns selectable stock and simple results', async () => {
  let capturedStockTerms;
  let capturedSimpleTerms;
  const repository = emptyRepository({
    findTextStockItems: async ({ terms }) => {
      capturedStockTerms = terms;
      return [{ id: 421, productId: 99, barcode: 'STOCK-421', serialNumber: 'SN-421', status: 'IN_STOCK', product: structuredProduct }];
    },
    findTextSimpleLots: async ({ terms }) => {
      capturedSimpleTerms = terms;
      return [{ id: 3, productId: 3129, barcode: 'SIMPLE-LOT-3', qtyRemaining: 8, status: 'ACTIVE', product: simpleProduct }];
    },
  });

  const result = await searchSaleItems({ branchId: 1, query: 'Acer A315', repository });

  assert.deepEqual(capturedStockTerms, ['Acer', 'A315']);
  assert.deepEqual(capturedSimpleTerms, ['Acer', 'A315']);
  assert.equal(result.matchMode, 'TEXT');
  assert.equal(result.autoSelect, false);
  assert.equal(result.total, 2);
});

test('no search result is a normal empty response', async () => {
  const result = await searchSaleItems({ branchId: 2, query: 'not-found', repository: emptyRepository() });
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

test('NON_STOCK product is not accepted through inventory search', async () => {
  const repository = emptyRepository({
    findExactStockItems: async () => [{
      id: 421,
      productId: 99,
      barcode: 'NON-STOCK-421',
      status: 'IN_STOCK',
      product: { ...structuredProduct, inventoryBehavior: 'NON_STOCK' },
    }],
  });

  await assert.rejects(
    () => searchSaleItems({ branchId: 1, query: 'NON-STOCK-421', repository }),
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
        branchPrice: [{ priceRetail: 107, priceWholesale: 107, priceTechnician: 107, priceOnline: null }],
      },
    }],
  });

  const result = await searchSaleItems({ branchId: 1, query: 'STOCK-422', repository });
  assert.deepEqual(result.items[0].prices, { retail: 107, wholesale: 107, technician: 107, online: null });
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
    payment: { paymentItems: [{ paymentMethod: 'CASH', amount: 100 }] },
  });

  assert.equal(command.sale.items[0].simpleLotId, 3);
  assert.equal(command.sale.items[0].stockItemId, null);
  assert.equal(Object.hasOwn(command.sale.items[0], 'barcode'), false);
});
