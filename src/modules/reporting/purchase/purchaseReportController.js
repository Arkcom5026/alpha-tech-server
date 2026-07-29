'use strict';

const runtime = require('./runtime/purchaseReportRuntime');

const getPurchaseReport = (req, res) => runtime.getPurchaseReport(req, res);
const getPurchaseReceiptReport = (req, res) => runtime.getPurchaseReceiptReport(req, res);
const getPurchaseReceiptReportDetail = (req, res) => runtime.getPurchaseReceiptReportDetail(req, res);

module.exports = {
  getPurchaseReport,
  getPurchaseReceiptReport,
  getPurchaseReceiptReportDetail,
};
