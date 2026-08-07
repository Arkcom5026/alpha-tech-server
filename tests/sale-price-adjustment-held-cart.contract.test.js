const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseSnapshot } = require('../src/modules/sales/held-cart/contracts/posHeldCartContract');

{
  const snapshot = parseSnapshot({
    items: [
      {
        lineId: 'STOCK_ITEM-1',
        lineType: 'STOCK_ITEM',
        productId: 10,
        stockItemId: 100,
        productName: 'Notebook',
        quantity: 1,
        price: 10000,
        priceAdjustment: 500,
        adjustmentReason: 'ค่าบริการเพิ่มเติม',
      },
      {
        lineId: 'SIMPLE-20',
        lineType: 'SIMPLE',
        productId: 20,
        simpleLotId: 200,
        productName: 'Cable',
        quantity: 2,
        price: 100,
        priceAdjustment: -20,
        adjustmentReason: 'ราคาพิเศษ',
      },
    ],
  });

  assert.equal(snapshot.totalBeforeDiscount, 10200);
  assert.equal(snapshot.totalPriceAdjustment, 480);
  assert.equal(snapshot.totalDiscount, 20);
  assert.equal(snapshot.totalAmount, 10680);
  assert.equal(snapshot.items[0].priceAdjustment, 500);
  assert.equal(snapshot.items[0].finalPrice, 10500);
  assert.equal(snapshot.items[0].adjustmentReason, 'ค่าบริการเพิ่มเติม');
  assert.equal(snapshot.items[1].priceAdjustment, -20);
  assert.equal(snapshot.items[1].finalPrice, 180);
}

{
  const legacy = parseSnapshot({
    items: [{
      lineId: 'STOCK_ITEM-2',
      lineType: 'STOCK_ITEM',
      productId: 11,
      stockItemId: 101,
      productName: 'Legacy item',
      quantity: 1,
      price: 1000,
      discount: 100,
    }],
  });
  assert.equal(legacy.items[0].priceAdjustment, -100);
  assert.equal(legacy.totalAmount, 900);
}

assert.throws(
  () => parseSnapshot({
    items: [{
      lineId: 'STOCK_ITEM-3',
      lineType: 'STOCK_ITEM',
      productId: 12,
      stockItemId: 102,
      productName: 'Invalid item',
      quantity: 1,
      price: 100,
      priceAdjustment: -101,
    }],
  }),
  (error) => error?.code === 'HELD_CART_TOTAL_INVALID'
);

const migration = fs.readFileSync(
  path.join(__dirname, '../prisma/migrations/20260807183000_sale_price_adjustment_evidence/migration.sql'),
  'utf8'
);
assert.match(migration, /SalePriceAdjustmentEvidence/);
assert.match(migration, /HELD_CART/);
assert.match(migration, /capture_sale_item_price_adjustment/);
assert.match(migration, /capture_sale_item_simple_price_adjustment/);
assert.match(migration, /final_price_nonnegative/);

console.log('sale price adjustment held cart contract: PASS');
