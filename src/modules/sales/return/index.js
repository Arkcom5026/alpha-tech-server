module.exports = {
  contracts: require('./contracts'),
  controllers: require('./controllers/saleReturnController'),
  services: require('./services/saleReturnService'),
  repositories: require('./repositories/saleReturnRepository'),
  policies: {
    ...require('./policies/saleReturnApprovalPolicy'),
    ...require('./policies/saleReturnIdempotencyPolicy'),
    ...require('./policies/saleReturnRefundPolicy'),
    ...require('./policies/saleReturnStockPolicy'),
  },
  validators: require('./validators/saleReturnValidator'),
  mappers: require('./mappers/saleReturnMapper'),
  builders: {
    ...require('./builders/saleReturnEligibilityBuilder'),
    ...require('./builders/saleReturnRefundBuilder'),
    ...require('./builders/saleReturnMovementBuilder'),
  },
  router: require('./routes/saleReturnRoutes'),
};
