module.exports = {
  controllers: {
    ...require('./controllers/activeSale.controller'),
    ...require('./controllers/completeSale.controller'),
  },
  contracts: require('./contracts/completeSale.contract'),
  services: {
    ...require('./services/completeSale.service'),
    ...require('./services/paymentPosting.service'),
  },
};
