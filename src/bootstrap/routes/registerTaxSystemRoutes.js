'use strict';

const taxPeriodRoutes = require('../../modules/tax/periods/taxPeriodRoutes');
const taxIntakeRoutes = require('../../modules/tax/http/taxIntakeRoutes');
const taxExpenseRoutes = require('../../modules/tax-expense/routes/taxExpenseRoutes');
const simpleStockRoutes = require('../../modules/inventory/simple-stock/routes/simpleStockRoutes');
const missingCostResolutionReadRoutes = require('../../modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionReadRoutes');
const missingCostResolutionMutationRoutes = require('../../modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionMutationRoutes');
const missingCostResolutionRecoveryPreviewRoutes = require('../../modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionRecoveryPreviewRoutes');
const missingCostResolutionRecoveryExecutionRoutes = require('../../modules/inventory/recovery/missing-cost-resolution/runtime/routes/missingCostResolutionRecoveryExecutionRoutes');
const operationalVerificationRoutes = require('../../modules/system/operational-verification/operationalVerificationRoutes');
const uploadProductRoutes = require('../../modules/product/media/routes/uploadProductRoutes');
const storeDeviceRoutes = require('../../modules/storeDevice/routes/storeDeviceRoutes');
const documentPurposeRoutes = require('../../modules/document-purpose/http/documentPurposeRoutes');

const registerTaxSystemRoutes = (app) => {
  app.use('/api/tax-periods', taxPeriodRoutes);
  app.use('/api/tax-intake', taxIntakeRoutes);
  app.use('/api/tax-expenses', taxExpenseRoutes);
  app.use('/api/simple-stock', simpleStockRoutes);
  app.use('/api/missing-cost-resolutions', missingCostResolutionReadRoutes);
  app.use('/api/missing-cost-resolutions', missingCostResolutionMutationRoutes);
  app.use('/api/missing-cost-resolutions', missingCostResolutionRecoveryPreviewRoutes);
  app.use('/api/missing-cost-resolutions', missingCostResolutionRecoveryExecutionRoutes);
  app.use('/api/operational-verification', operationalVerificationRoutes);
  app.use('/api/products/upload', uploadProductRoutes);
  app.use('/api/store-devices', storeDeviceRoutes);
  app.use('/api/document-purposes', documentPurposeRoutes);
};

module.exports = { registerTaxSystemRoutes };
