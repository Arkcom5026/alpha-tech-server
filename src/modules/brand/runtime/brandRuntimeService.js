const repository = require('./brandRuntimeRepository');
const { BrandService } = require('../services/brandService');

module.exports = new BrandService(null, repository);
