'use strict';

const validateReceiveCustomerMoneyPolicy = ({ amount }) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    const error = new Error('Receive amount must be greater than zero');
    error.code = 'CUSTOMER_MONEY_RECEIVE_INVALID_AMOUNT';
    throw error;
  }

  return true;
};

module.exports = { validateReceiveCustomerMoneyPolicy };
