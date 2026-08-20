'use strict'

const {
  SystemDocumentPurposeBootstrapService,
} = require('../../document-purpose/bootstrap/systemDocumentPurposeBootstrapService')
const {
  SystemDocumentPurposeBootstrapRepository,
} = require('../../document-purpose/bootstrap/systemDocumentPurposeBootstrapRepository')

const ensurePartnerStoreDocumentPurposeReadiness = async ({ tx, branchId, actorEmployeeId = null }) => {
  const repository = new SystemDocumentPurposeBootstrapRepository(tx)
  const service = new SystemDocumentPurposeBootstrapService(repository)
  return service.execute({ branchId, actorEmployeeId })
}

module.exports = {
  ensurePartnerStoreDocumentPurposeReadiness,
}
