const { parseCompleteSaleCommand } = require('../contracts/saleCompletionContract');

const validateSaleCompletionRequest = (body) => parseCompleteSaleCommand(body);

module.exports = { validateSaleCompletionRequest };
