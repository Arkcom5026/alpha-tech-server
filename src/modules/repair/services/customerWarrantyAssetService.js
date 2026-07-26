const customerWarrantyAssetsService = require('../query/customer-warranty-assets/customerWarrantyAssetsService');

module.exports = customerWarrantyAssetsService;
module.exports.CustomerWarrantyAssetService =
  customerWarrantyAssetsService.CustomerWarrantyAssetsService;
module.exports.CustomerWarrantyAssetsService =
  customerWarrantyAssetsService.CustomerWarrantyAssetsService;
