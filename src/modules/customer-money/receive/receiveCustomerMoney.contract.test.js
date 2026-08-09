'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { validateReceiveCustomerMoneyInput } = require('./receiveCustomerMoneyContract');

test('customer money receive contract accepts a valid isolated receive command', () => {
  const result = validateReceiveCustomerMoneyInput({
    customerId: 1,
    amount: 100,
    paymentMethod: 'CASH',
    description: 'รับชำระสินค้า',
  }, {
    branchId: 2,
    employeeId: 3,
  });

  assert.equal(result.customerId, 1);
  assert.equal(result.branchId, 2);
  assert.equal(result.createdById, 3);
  assert.equal(result.amount, 100);
  assert.equal(result.description, 'รับชำระสินค้า');
});

test('customer money receive contract rejects non-positive amount', () => {
  assert.throws(() => validateReceiveCustomerMoneyInput({
    customerId: 1,
    amount: 0,
    paymentMethod: 'CASH',
    description: 'รับเงินมัดจำ',
  }, {
    branchId: 2,
    employeeId: 3,
  }), (error) => error.code === 'CUSTOMER_MONEY_RECEIVE_INVALID_INPUT');
});
