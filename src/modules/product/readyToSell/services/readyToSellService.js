const operationalProductRuntimeService = require('../../runtime/services/operationalProductRuntimeService')

module.exports = {
  getReadyToSell: operationalProductRuntimeService.getReadyToSell,
  getReadyToSellStructuredDetails:
    operationalProductRuntimeService.getReadyToSellStructuredDetails,
}
