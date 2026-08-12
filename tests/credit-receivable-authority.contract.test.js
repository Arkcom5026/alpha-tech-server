'use strict';

const assert = require('node:assert/strict');
const {
  buildActiveCreditReceivableWhere,
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

console.log('credit-receivable-authority.contract: PASS');
