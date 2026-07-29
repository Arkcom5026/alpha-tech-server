'use strict';

const runtime = require('./runtime/combinedBillingRuntime');

const getCombinableSales = (req, res) => runtime.getCombinableSales(req, res);
const createCombinedBillingDocument = (req, res) => runtime.createCombinedBillingDocument(req, res);
const getCombinedBillingById = (req, res) => runtime.getCombinedBillingById(req, res);
const getCustomersWithPendingSales = (req, res) => runtime.getCustomersWithPendingSales(req, res);

module.exports = {
  getCombinableSales,
  createCombinedBillingDocument,
  getCombinedBillingById,
  getCustomersWithPendingSales,
};
