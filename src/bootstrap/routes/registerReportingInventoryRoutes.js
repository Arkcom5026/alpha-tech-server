'use strict';

const purchaseReportRoutes = require('../../modules/reporting/purchase/routes/purchaseReportRoutes');
const inputTaxReportRoutes = require('../../modules/reporting/tax/input/routes/inputTaxReportRoutes');
const combinedBillingRoutes = require('../../modules/finance/combined-billing/routes/combinedBillingRoutes');
const salesReportRoutes = require('../../modules/reporting/sales/routes/salesReportRoutes');
const uploadSlipRoutes = require('../../modules/commerce/payment-slip/routes/uploadSlipRoutes');
const stockAuditRoutes = require('../../modules/inventory/audit/routes/stockAuditRoutes');
const positionRoutes = require('../../modules/position/routes/positionRoutes');
const addressRoutes = require('../../modules/location/routes/addressRoutes');
const locationsRoutes = require('../../modules/location/routes/locationsRoutes');
const receiptSimpleRoutes = require('../../modules/procurement/receipt/simple/routes/receiptSimpleRoutes');
const quickReceiptRoutes = require('../../modules/inventory/quick-receipt/routes/quickReceiptRoutes');
const stockRoutes = require('../../modules/inventory/dashboard/routes/stockDashboardRoutes');
const financeRoutes = require('../../modules/finance/routes/financeRuntimeRoutes');

const registerReportingInventoryRoutes = (app) => {
  app.use('/api/purchase-reports', purchaseReportRoutes);
  app.use('/api/input-tax-reports', inputTaxReportRoutes);
  app.use('/api/combined-billing', combinedBillingRoutes);
  app.use('/api/sales-reports', salesReportRoutes);
  app.use('/api/upload-slip', uploadSlipRoutes);
  app.use('/api/stock-audits', stockAuditRoutes);
  app.use('/api/positions', positionRoutes);
  app.use('/api/address', addressRoutes);
  app.use('/api/locations', locationsRoutes);
  app.use('/api/receipt-simple', receiptSimpleRoutes);
  app.use('/api/quick-receipts', quickReceiptRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/finance', financeRoutes);
};

module.exports = { registerReportingInventoryRoutes };
