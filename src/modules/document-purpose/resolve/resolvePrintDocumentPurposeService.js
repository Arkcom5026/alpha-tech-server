'use strict'

const {
  normalizeDocumentPurposeCode,
} = require('../shared/documentPurposeDomain')
const {
  DocumentPurposeReadRepository,
} = require('../read/documentPurposeReadRepository')

const fail = (code, message, statusCode = 409, detail) => {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  if (detail !== undefined) error.detail = detail
  throw error
}

const positiveInt = (value, field) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    fail('DOCUMENT_PURPOSE_CONTEXT_INVALID', `${field} must be a positive integer`, 400)
  }
  return parsed
}

class ResolvePrintDocumentPurposeService {
  constructor(repository = new DocumentPurposeReadRepository()) {
    this.repository = repository
  }

  async execute({ branchId, code }) {
    const normalizedBranchId = positiveInt(branchId, 'branchId')
    const normalizedCode = normalizeDocumentPurposeCode(code)

    const purpose = await this.repository.findByCode({
      branchId: normalizedBranchId,
      normalizedCode,
    })

    if (!purpose) {
      fail(
        'DOCUMENT_PURPOSE_NOT_FOUND',
        `Document purpose ${normalizedCode} is not registered for this branch`,
        404,
        { branchId: normalizedBranchId, code: normalizedCode },
      )
    }

    if (purpose.isSystem !== true) {
      fail(
        'DOCUMENT_PURPOSE_SYSTEM_REQUIRED',
        `Document purpose ${normalizedCode} is not system-owned`,
        409,
        { branchId: normalizedBranchId, definitionId: purpose.id, code: normalizedCode },
      )
    }

    if (purpose.lifecycleState !== 'ACTIVE') {
      fail(
        'DOCUMENT_PURPOSE_INACTIVE',
        `Document purpose ${normalizedCode} is not active`,
        409,
        {
          branchId: normalizedBranchId,
          definitionId: purpose.id,
          code: normalizedCode,
          lifecycleState: purpose.lifecycleState,
        },
      )
    }

    if (purpose.metadata?.printEligible !== true) {
      fail(
        'DOCUMENT_PURPOSE_PRINT_NOT_ELIGIBLE',
        `Document purpose ${normalizedCode} is not eligible for printing`,
        409,
        { branchId: normalizedBranchId, definitionId: purpose.id, code: normalizedCode },
      )
    }

    return Object.freeze({
      id: purpose.id,
      branchId: purpose.branchId,
      code: purpose.code,
      normalizedCode: purpose.normalizedCode,
      displayName: purpose.displayName,
      categoryCode: purpose.categoryCode,
      lifecycleState: purpose.lifecycleState,
      currentVersion: purpose.currentVersion,
      metadata: purpose.metadata,
    })
  }
}

module.exports = {
  ResolvePrintDocumentPurposeService,
}
