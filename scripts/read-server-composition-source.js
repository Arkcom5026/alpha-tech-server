'use strict';

const fs = require('fs');
const path = require('path');

const compositionFiles = [
  'server.js',
  'src/bootstrap/createApp.js',
  'src/bootstrap/middleware/registerCoreMiddleware.js',
  'src/bootstrap/routes/registerRoutes.js',
  'src/bootstrap/routes/registerIdentityCustomerCatalogRoutes.js',
  'src/bootstrap/routes/registerServiceProcurementInventoryRoutes.js',
  'src/bootstrap/routes/registerSalesRoutes.js',
  'src/bootstrap/routes/registerProcurementFinanceRoutes.js',
  'src/bootstrap/routes/registerCommercePlatformRoutes.js',
  'src/bootstrap/routes/registerReportingInventoryRoutes.js',
  'src/bootstrap/routes/registerTaxSystemRoutes.js',
  'src/bootstrap/errors/registerErrorHandlers.js',
];

const readServerCompositionSource = (root = path.resolve(__dirname, '..')) => compositionFiles
  .map((relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8'))
  .join('\n')
  // Preserve the root-relative import vocabulary used by legacy source contracts.
  .replaceAll("require('../../modules/", "require('./src/modules/")
  .replaceAll("require('../../../middlewares/", "require('./middlewares/");

module.exports = { compositionFiles, readServerCompositionSource };
