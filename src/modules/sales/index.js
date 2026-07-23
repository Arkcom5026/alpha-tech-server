module.exports = {
  controllers: {
    ...require('./compatibility/saleLegacyCompatibilityController'),
    ...require('./completion/controllers/saleCompletionController'),
  },
  contracts: require('./completion/contracts/saleCompletionContract'),
  services: {
    ...require('./completion/services/saleCompletionService'),
    ...require('./completion/services/salePaymentPostingService'),
  },
};
