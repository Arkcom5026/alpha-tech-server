'use strict';

const assert = require('assert');
const {
  assertSaleTaxDocumentEligibility,
} = require('../src/modules/tax/sources/sale/saleTaxDocumentEligibilityPolicy');

assert.doesNotThrow(() => {
  assertSaleTaxDocumentEligibility({ statusPayment: 'PAID' });
});

for (const statusPayment of ['UNPAID', 'PARTIAL', 'PENDING', null, undefined]) {
  assert.throws(
    () => assertSaleTaxDocumentEligibility({ statusPayment }),
    (error) => error.code === 'TAX_SOURCE_SALE_PAYMENT_REQUIRED' && error.statusCode === 409,
    `Expected ${statusPayment || 'missing'} payment to be rejected`,
  );
}

console.log('Sale tax-document payment eligibility contract: PASS');
