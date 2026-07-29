const professionalAccessRoutes = require('./routes/professionalAccessRoutes');
const professionalAccessContract = require('./contracts/professionalAccess.contract');
const professionalAccessAuthority = require('./shared/professionalAccessAuthority');

const mountProfessionalAccessModule = (app) => {
  app.use(professionalAccessContract.PROFESSIONAL_ACCESS_BASE_PATH, professionalAccessRoutes);
};

module.exports = {
  mountProfessionalAccessModule,
  professionalAccessAuthority,
  professionalAccessContract,
  professionalAccessRoutes,
};
