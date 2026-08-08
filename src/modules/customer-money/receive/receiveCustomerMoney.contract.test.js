'use strict';

const assert = require('assert');

const { validateReceiveCustomerMoneyInput } = require('./receiveCustomerMoneyContract');

describe('customer money receive contract', () => {
  it('accepts valid receive money payload', () => {
    const result = validateReceiveCustomerMoneyInput({
      customerId: 1,
      branchId: 1,
      amount: 100,
      paymentMethod: 'CASH'
    });

    assert.strictEqual(result.valid, true);
  });

  it('rejects non-positive amount', () => {
    const result = validateReceiveCustomerMoneyInput({
      customerId: 1,
      branchId: 1,
      amount: 0
    });

    assert.strictEqual(result.valid, false);
  });
});
