'use strict';

const runtime = require('./runtime/salesReportRuntime');

const getSalesTaxReport = (req, res) => runtime.getSalesTaxReport(req, res);
const getSalesDashboard = (req, res) => runtime.getSalesDashboard(req, res);
const getSalesList = (req, res) => runtime.getSalesList(req, res);
const getProductPerformance = (req, res) => runtime.getProductPerformance(req, res);
const getSalesDetail = (req, res) => runtime.getSalesDetail(req, res);

module.exports = {
  getSalesTaxReport,
  getSalesDashboard,
  getSalesList,
  getProductPerformance,
  getSalesDetail,
};
