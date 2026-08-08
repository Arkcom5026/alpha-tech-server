'use strict';

const { registerIdentityCustomerCatalogRoutes } = require('./registerIdentityCustomerCatalogRoutes');
const { registerServiceProcurementInventoryRoutes } = require('./registerServiceProcurementInventoryRoutes');
const { registerSalesRoutes } = require('./registerSalesRoutes');
const { registerProcurementFinanceRoutes } = require('./registerProcurementFinanceRoutes');
const { registerCommercePlatformRoutes } = require('./registerCommercePlatformRoutes');
const { registerReportingInventoryRoutes } = require('./registerReportingInventoryRoutes');
const { registerTaxSystemRoutes } = require('./registerTaxSystemRoutes');

const registerRoutes = (app) => {
  registerIdentityCustomerCatalogRoutes(app);
  registerServiceProcurementInventoryRoutes(app);
  registerSalesRoutes(app);
  registerProcurementFinanceRoutes(app);
  registerCommercePlatformRoutes(app);
  registerReportingInventoryRoutes(app);
  registerTaxSystemRoutes(app);
};

module.exports = { registerRoutes };
