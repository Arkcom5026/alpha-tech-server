'use strict';

const runtime = require('./runtime/inputTaxReportRuntime');

const getInputTaxReport = (req, res) => runtime.getInputTaxReport(req, res);

module.exports = { getInputTaxReport };
