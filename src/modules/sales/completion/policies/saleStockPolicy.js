const { SaleCompletionError } = require('../contracts/saleCompletionError');

const stockConflict = (message, details) =>
  new SaleCompletionError(409, 'STOCK_CONFLICT', message, details);

module.exports = { stockConflict };
