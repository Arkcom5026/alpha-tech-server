'use strict';

const supplierPaymentRoutes = require('../../modules/procurement/supplier-payment/routes/supplierPaymentRoutes');
const supplierPayableRoutes = require('../../modules/procurement/payables/http/supplierPayableRoutes');
const supplierPaymentAllocationRoutes = require('../../modules/procurement/payments/http/supplierPaymentAllocationRoutes');
const supplierAdvanceRoutes = require('../../modules/procurement/advances/http/supplierAdvanceRoutes');
const bankRoutes = require('../../modules/finance/bank/routes/bankRoutes');

const registerProcurementFinanceRoutes = (app) => {
  app.use('/api/supplier-payments', supplierPaymentRoutes);
  app.use('/api/supplier-payables', supplierPayableRoutes);
  app.use('/api/supplier-settlements', supplierPaymentAllocationRoutes);
  app.use('/api/supplier-advances', supplierAdvanceRoutes);
  app.use('/api/banks', bankRoutes);
};

module.exports = { registerProcurementFinanceRoutes };
