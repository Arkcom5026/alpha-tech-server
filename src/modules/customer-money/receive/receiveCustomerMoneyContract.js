'use strict';

const validateReceiveCustomerMoneyInput = (input = {}) => {
  const errors = [];

  if (!input.customerId) errors.push('customerId is required');
  if (!input.branchId) errors.push('branchId is required');
  if (input.amount === undefined || input.amount === null) {
    errors.push('amount is required');
  }

  if (errors.length) {
    const error = new Error('Invalid customer money receive input');
    error.code = 'CUSTOMER_MONEY_RECEIVE_INVALID_INPUT';
    error.details = errors;
    throw error;
  }

  return {
    customerId: Number(input.customerId),
    branchId: Number(input.branchId),
    amount: input.amount,
    paymentMethod: input.paymentMethod || null,
    note: input.note || null,
    createdById: input.createdById || null,
  };
};

module.exports = { validateReceiveCustomerMoneyInput };
