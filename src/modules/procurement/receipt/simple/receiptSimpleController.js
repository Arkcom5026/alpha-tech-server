'use strict';

const runtime = require('./runtime/receiptSimpleRuntime');

const create = (req, res) => runtime.create(req, res);
const preview = (req, res) => runtime.preview(req, res);

module.exports = { create, preview };
