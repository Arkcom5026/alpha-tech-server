const runtimeRepository = require('../../runtime/repositories/operationalProductRuntimeRepository')

module.exports = {
  transaction: runtimeRepository.transaction,
  findTemplateBranchByCode: runtimeRepository.findTemplateBranchByCode,
  findTemplateProductForClone: runtimeRepository.findTemplateProductForClone,
  findBranchProductTypeByGlobalProductTypeId: runtimeRepository.findBranchProductTypeByGlobalProductTypeId,
  findOperationalRuntimeProductByTemplateId: runtimeRepository.findOperationalRuntimeProductByTemplateId,
  createOperationalProductRecordFromTemplate: runtimeRepository.createOperationalProductRecordFromTemplate,
}
