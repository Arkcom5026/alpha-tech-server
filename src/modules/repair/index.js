module.exports = {
  routes: require('./routes/repairRoutes'),
  repairController: require('./controllers/repairController'),
  repairService: require('./services/repairService'),
  repairIntakeService: require('./services/repairIntakeService'),
  warrantyClaimService: require('./services/warrantyClaimService'),
  repairRepository: require('./repositories/repairRepository'),
  contracts: require('./contracts'),
};
