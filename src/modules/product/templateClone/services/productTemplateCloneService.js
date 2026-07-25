const runtimeService = require('../../services/operationalProductRuntimeService')

const cloneOperationalProductFromTemplate = async ({ branchId, templateProductId } = {}) => {
  return runtimeService.createOperationalProductFromTemplate({
    branchId,
    templateProductId,
  })
}

module.exports = {
  cloneOperationalProductFromTemplate,
}
