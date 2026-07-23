module.exports = {
  controllers: {
    ...require('./completion/controllers/saleCompletionController'),
    ...require('./create/controllers/saleLegacyCreateController'),
    ...require('./documents/controllers/saleDocumentController'),
    ...require('./history/controllers/saleHistoryController'),
    ...require('./settlement/controllers/saleSettlementController'),
  },
  contracts: require('./completion/contracts/saleCompletionContract'),
  services: {
    ...require('./completion/services/saleCompletionService'),
    ...require('./completion/services/salePaymentPostingService'),
  },
};
