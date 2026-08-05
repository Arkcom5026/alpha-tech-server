'use strict';

const assert = require('node:assert/strict');
const {
  toNestedItemCreate,
} = require('../src/modules/tax-expense/create/createTaxExpenseSlice');

const nested = toNestedItemCreate({
  categoryId: 7,
  lineNumber: 1,
  description: 'Office expense',
  quantity: '1.00',
  unitAmount: '100.00',
  subtotalAmount: '100.00',
  vatAmount: '7.00',
  withholdingTaxAmount: '0.00',
  vatTreatment: 'PENDING_REVIEW',
  citTreatment: 'PENDING_REVIEW',
  whtTreatment: 'NOT_APPLICABLE',
  withholdingTaxRate: null,
}, 2);

assert.equal(Object.hasOwn(nested, 'categoryId'), false);
assert.equal(Object.hasOwn(nested, 'branchId'), false);
assert.deepEqual(nested.category, {
  connect: {
    id_branchId: { id: 7, branchId: 2 },
  },
});
assert.equal(nested.description, 'Office expense');

console.log('Tax expense item category connect contract: PASS');
