const assert = require('node:assert/strict');
const {
  normalizePriceAdjustment,
  summarizePriceAdjustments,
} = require('../src/modules/sales/completion/policies/salePriceAdjustmentPolicy');

{
  const reduced = normalizePriceAdjustment({ basePrice: 10000, priceAdjustment: -500, price: 9500 });
  assert.equal(reduced.priceAdjustment, -500);
  assert.equal(reduced.finalPrice, 9500);
  assert.equal(reduced.discountAmount, 500);

  const increased = normalizePriceAdjustment({
    basePrice: 10000,
    priceAdjustment: 500,
    price: 10500,
    adjustmentReason: 'ค่าบริการเพิ่มเติม',
  });
  assert.equal(increased.priceAdjustment, 500);
  assert.equal(increased.finalPrice, 10500);
  assert.equal(increased.discountAmount, 0);
  assert.equal(increased.adjustmentReason, 'ค่าบริการเพิ่มเติม');

  const legacy = normalizePriceAdjustment({ basePrice: 10000, discount: 500, price: 9500 });
  assert.equal(legacy.priceAdjustment, -500);
  assert.equal(legacy.finalPrice, 9500);

  const summary = summarizePriceAdjustments([reduced, increased]);
  assert.deepEqual(summary, {
    totalBeforeAdjustment: 20000,
    totalPriceAdjustment: 0,
    totalDiscount: 500,
    totalAmount: 20000,
  });
}

assert.throws(
  () => normalizePriceAdjustment({ basePrice: 100, priceAdjustment: -101 }),
  (error) => error?.code === 'SALE_PRICE_ADJUSTMENT_BELOW_ZERO'
);

assert.throws(
  () => normalizePriceAdjustment({ basePrice: 100, priceAdjustment: 'abc' }),
  (error) => error?.code === 'SALE_VALIDATION_FAILED'
);

console.log('sale price adjustment policy contract: PASS');
