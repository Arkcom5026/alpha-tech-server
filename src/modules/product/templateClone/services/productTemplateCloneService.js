const runtimeService = require('../../runtime/services/operationalProductRuntimeService')

const cloneOperationalProductFromTemplate = async ({ branchId, templateProductId } = {}) => {
  return runtimeService.createOperationalProductFromTemplate({
    branchId,
    templateProductId,
  })
}

module.exports = {
  cloneOperationalProductFromTemplate,
}
