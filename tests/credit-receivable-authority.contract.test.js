'use strict';

const assert = require('node:assert/strict');
const {
  buildActiveCreditReceivableWhere,
  calculateReturnedReceivableAmount,
  calculateNetReceivableTotal,
  calculateOutstandingReceivable,
} = require('../src/modules/sales/shared/creditReceivableAuthority');

const where = buildActiveCreditReceivableWhere({ branchId: 2, customerIds: [35, 102] });
assert.deepEqual(where, {
  branchId: 2,
  customerId: { in: [35, 102] },
  isCredit: true,
  status: { not: 'CANCELLED' },
  statusPayment: { in: ['UNPAID', 'PARTIALLY_PAID'] },
});
assert.equal(Object.prototype.hasOwnProperty.call(where.status, 'in'), false, 'DRAFT credit sales must not be excluded');
assert.equal(calculateOutstandingReceivable({ totalAmount: 12100, paidAmount: 0 }), 12100);
assert.equal(calculateOutstandingReceivable({ totalAmount: 12100, paidAmount: 2100 }), 10000);
assert.equal(calculateOutstandingReceivable({ totalAmount: 100, paidAmount: 120 }), 0);

// Production reference case: SL-022608-0077 / Sale 1046.
// Original 1,810.00, unpaid, return SIMPLE 2 x 320.00 = 640.00.
const referenceSale = {
  totalAmount: 1810,
  paidAmount: 0,
  items: [
    { price: 1170, returnedQuantity: 0 },
  ],
  simpleItems: [
    { quantity: 2, price: 640, returnedQuantity: 2 },
  ],
};
assert.equal(calculateReturnedReceivableAmount(referenceSale), 640);
assert.equal(calculateNetReceivableTotal(referenceSale), 1170);
assert.equal(calculateOutstandingReceivable(referenceSale), 1170);

// Partial SIMPLE return must reduce only the proportional line value.
assert.equal(calculateReturnedReceivableAmount({
  simpleItems: [{ quantity: 4, price: 1000, returnedQuantity: 1 }],
}), 250);

// Serialized items are one-unit lines; a completed return removes the full line value.
assert.equal(calculateReturnedReceivableAmount({
  items: [{ price: 390, returnedQuantity: 1 }],
}), 390);

// Payment evidence is applied after the return adjustment, preventing settlement overpayment.
assert.equal(calculateOutstandingReceivable({
  totalAmount: 1810,
  paidAmount: 500,
  simpleItems: [{ quantity: 2, price: 640, returnedQuantity: 2 }],
}), 670);

// Full return leaves no receivable even if the original Sale.totalAmount remains immutable.
assert.equal(calculateOutstandingReceivable({
  totalAmount: 1810,
  paidAmount: 0,
  items: [{ price: 1170, returnedQuantity: 1 }],
  simpleItems: [{ quantity: 2, price: 640, returnedQuantity: 2 }],
}), 0);

console.log('credit-receivable-authority.contract: PASS');
