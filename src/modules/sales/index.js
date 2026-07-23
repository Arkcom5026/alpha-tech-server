const saleReturn = require('./return');

module.exports = {
  controllers: {
    ...require('./completion/controllers/saleCompletionController'),
    ...require('./create/controllers/saleLegacyCreateController'),
    ...require('./documents/controllers/saleDocumentController'),
    ...require('./history/controllers/saleHistoryController'),
    ...require('./settlement/controllers/saleSettlementController'),
    ...saleReturn.controllers,
  },
  contracts: {
    ...require('./completion/contracts/saleCompletionContract'),
    return: saleReturn.contracts,
  },
  services: {
    ...require('./completion/services/saleCompletionService'),
    ...require('./completion/services/salePaymentPostingService'),
    ...saleReturn.services,
  },
  return: saleReturn,
};
