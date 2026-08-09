'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveInputTaxReceiptVatPolicy } = require('./inputTaxReceiptVatPolicy');

test('preserves explicit source VAT amounts as authority', () => {
  const policy = resolveInputTaxReceiptVatPolicy({
    sourceSubtotalAmount: 100,
    sourceVatAmount: 7,
    sourceTotalAmount: 107,
  });
  assert.equal(policy.ratePercent, 7);
  assert.equal(policy.autoCalculate, false);
  assert.equal(policy.authority, 'SOURCE_AMOUNTS');
});

test('defaults receipt-without-tax-split to central Thailand standard VAT policy', () => {
  const policy = resolveInputTaxReceiptVatPolicy({
    sourceSubtotalAmount: 23490,
    sourceVatAmount: 0,
    sourceTotalAmount: 23490,
  });
  assert.deepEqual(policy, {
    treatment: 'STANDARD_RATE',
    ratePercent: 7,
    priceMode: 'INCLUSIVE',
    autoCalculate: true,
    authority: 'THAILAND_STANDARD_DEFAULT',
  });
});

test('supports zero-rated, exempt, and non-VAT source treatment without VAT', () => {
  for (const treatment of ['ZERO_RATED', 'EXEMPT', 'NON_VAT']) {
    const policy = resolveInputTaxReceiptVatPolicy({ sourceTotalAmount: 100, taxTreatment: treatment });
    assert.equal(policy.treatment, treatment);
    assert.equal(policy.ratePercent, 0);
    assert.equal(policy.authority, 'SOURCE_TAX_TREATMENT');
  }
});

test('does not calculate when source semantics are insufficient', () => {
  const policy = resolveInputTaxReceiptVatPolicy({});
  assert.equal(policy.treatment, 'UNKNOWN');
  assert.equal(policy.autoCalculate, false);
  assert.equal(policy.authority, 'INSUFFICIENT_SOURCE_SEMANTICS');
});
