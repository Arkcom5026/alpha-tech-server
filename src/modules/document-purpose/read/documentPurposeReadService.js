'use strict'

const { DocumentPurposeReadRepository } = require('./documentPurposeReadRepository')
const {
  assertLifecycleState,
  normalizeDocumentPurposeCode,
} = require('../shared/documentPurposeDomain')

const asPositiveInt = (value, field) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${field} must be a positive integer`)
    error.code = 'DOCUMENT_PURPOSE_VALIDATION_ERROR'
    error.statusCode = 400
    throw error
  }
  return parsed
}

const optionalText = (value) => {
  if (value === undefined || value === null || value === '') return null
  const normalized = String(value).trim()
  return normalized || null
}

class DocumentPurposeReadService {
  constructor(repository = new DocumentPurposeReadRepository()) {
    this.repository = repository
  }

  async list({ branchId, query = {} }) {
    const ownerBranchId = asPositiveInt(branchId, 'branchId')
    const lifecycleState = query.lifecycleState
      ? assertLifecycleState(query.lifecycleState)
      : null
    const categoryCode = optionalText(query.categoryCode)
    const includeArchived = String(query.includeArchived ?? '').toLowerCase() === 'true'

    return this.repository.list({
      branchId: ownerBranchId,
      lifecycleState,
      categoryCode,
      includeArchived,
    })
  }

  async getById({ branchId, definitionId }) {
    const definition = await this.repository.findById({
      branchId: asPositiveInt(branchId, 'branchId'),
      definitionId: asPositiveInt(definitionId, 'definitionId'),
    })

    if (!definition) {
      const error = new Error('Document purpose not found')
      error.code = 'DOCUMENT_PURPOSE_NOT_FOUND'
      error.statusCode = 404
      throw error
    }

    return definition
  }

  async getByCode({ branchId, code }) {
    const definition = await this.repository.findByCode({
      branchId: asPositiveInt(branchId, 'branchId'),
      normalizedCode: normalizeDocumentPurposeCode(code),
    })

    if (!definition) {
      const error = new Error('Document purpose not found')
      error.code = 'DOCUMENT_PURPOSE_NOT_FOUND'
      error.statusCode = 404
      throw error
    }

    return definition
  }

  async listVersions({ branchId, definitionId }) {
    const ownerBranchId = asPositiveInt(branchId, 'branchId')
    const id = asPositiveInt(definitionId, 'definitionId')
    await this.getById({ branchId: ownerBranchId, definitionId: id })
    return this.repository.listVersions({ branchId: ownerBranchId, definitionId: id })
  }

  async listEvents({ branchId, definitionId }) {
    const ownerBranchId = asPositiveInt(branchId, 'branchId')
    const id = asPositiveInt(definitionId, 'definitionId')
    await this.getById({ branchId: ownerBranchId, definitionId: id })
    return this.repository.listEvents({ branchId: ownerBranchId, definitionId: id })
  }
}

module.exports = {
  DocumentPurposeReadService,
}
