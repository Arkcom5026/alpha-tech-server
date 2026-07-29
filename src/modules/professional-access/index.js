const professionalAccessRoutes = require('./routes/professionalAccessRoutes');

const mountProfessionalAccessModule = (app) => {
  app.use('/api/professional-access', professionalAccessRoutes);
};

module.exports = {
  mountProfessionalAccessModule,
  professionalAccessRoutes,
};
