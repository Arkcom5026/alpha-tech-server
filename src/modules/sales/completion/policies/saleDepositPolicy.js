const { SaleCompletionError } = require('../contracts/saleCompletionError');

const assertDepositBalance = ({ amount, totalAmount, usedAmount }) => {
  const remaining = Number(totalAmount) - Number(usedAmount);
  if (Number(amount) > remaining + 0.001) {
    throw new SaleCompletionError(409, 'DEPOSIT_BALANCE_CONFLICT', 'Deposit balance is insufficient');
  }
  return remaining;
};

module.exports = { assertDepositBalance };
