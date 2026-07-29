'use strict';

const branchRoutes = require('./routes/branchRoutes');
const branchController = require('./controllers/branchController');
const branchFeaturePresets = require('./constants/branchFeaturePresets');

module.exports = Object.freeze({
  branchRoutes,
  branchController,
  branchFeaturePresets,
});
