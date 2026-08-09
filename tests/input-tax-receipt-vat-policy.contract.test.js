'use strict';

const assert = require('node:assert/strict');
const { resolveInputTaxReceiptVatPolicy } = require('../src/modules/tax/inputDocuments/pending/inputTaxReceiptVatPolicy');

const sourceSplit = resolveInputTaxReceiptVatPolicy({
  sourceSubtotalAmount: 100,
  sourceVatAmount: 7,
  sourceTotalAmount: 107,
});
assert.equal(sourceSplit.treatment, 'STANDARD_RATE');
assert.equal(sourceSplit.ratePercent, 7);
assert.equal(sourceSplit.autoCalculate, false);
assert.equal(sourceSplit.authority, 'SOURCE_AMOUNTS');

const standardDefault = resolveInputTaxReceiptVatPolicy({
  sourceSubtotalAmount: 23490,
  sourceVatAmount: 0,
  sourceTotalAmount: 23490,
});
assert.equal(standardDefault.treatment, 'STANDARD_RATE');
assert.equal(standardDefault.ratePercent, 7);
assert.equal(standardDefault.priceMode, 'INCLUSIVE');
assert.equal(standardDefault.autoCalculate, true);
assert.equal(standardDefault.authority, 'THAILAND_STANDARD_DEFAULT');

for (const treatment of ['ZERO_RATED', 'EXEMPT', 'NON_VAT']) {
  const policy = resolveInputTaxReceiptVatPolicy({
    sourceTotalAmount: 100,
    taxTreatment: treatment,
  });
  assert.equal(policy.treatment, treatment);
  assert.equal(policy.ratePercent, 0);
  assert.equal(policy.autoCalculate, true);
  assert.equal(policy.authority, 'SOURCE_TAX_TREATMENT');
}

const insufficient = resolveInputTaxReceiptVatPolicy({});
assert.equal(insufficient.treatment, 'UNKNOWN');
assert.equal(insufficient.autoCalculate, false);
assert.equal(insufficient.authority, 'INSUFFICIENT_SOURCE_SEMANTICS');

console.log('input-tax-receipt-vat-policy.contract.test.js: PASS');
