'use strict'

const { requireBranchAuthority } = require('../policies/storeDeviceAuthorityPolicy')
const durableJobService = require('../services/storeDeviceDurableJobService')
const {
  projectOutputTaxPrintableDocument,
} = require('../../tax/documents/print/projectOutputTaxPrintableDocumentService')

const ALLOWED_PURPOSE_CODES = new Set([
  'SHORT_TAX_INVOICE',
  'FULL_TAX_INVOICE',
])

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const positiveInt = (value, code, field) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw fail(code, `${field} must be a positive integer`)
  }
  return parsed
}

const nonEmpty = (value, code, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(code, `${field} is required`)
  }
  return value.trim()
}

const normalizeCopies = (value) => {
  if (value === undefined || value === null || value === '') return 1
  const copies = Number(value)
  if (!Number.isInteger(copies) || copies < 1 || copies > 20) {
    throw fail('STORE_DEVICE_PRINT_COPIES_INVALID', 'copies must be an integer between 1 and 20')
  }
  return copies
}

const assertIdempotentJobCompatibility = ({
  job,
  taxDocumentId,
  copies,
  documentPurpose,
}) => {
  const snapshot = job?.requestSnapshot
  if (!snapshot) return

  const compatible =
    snapshot.schemaVersion === 1
    && snapshot.documentPurpose?.code === documentPurpose.code
    && Number(snapshot.source?.id) === taxDocumentId
    && snapshot.source?.type === 'TAX_DOCUMENT'
    && Number(snapshot.print?.copies) === copies

  if (!compatible) {
    throw fail(
      'STORE_DEVICE_PRINT_IDEMPOTENCY_CONFLICT',
      'idempotencyKey is already bound to a different print request',
      409,
    )
  }
}

const createOutputTaxInvoicePrintJobService = ({
  projector = projectOutputTaxPrintableDocument,
  jobService = durableJobService,
} = {}) => ({
  async execute({ user, taxDocumentId, payload = {} }) {
    const branchId = requireBranchAuthority(user)
    const normalizedTaxDocumentId = positiveInt(
      taxDocumentId,
      'STORE_DEVICE_PRINT_TAX_DOCUMENT_ID_INVALID',
      'taxDocumentId',
    )
    const idempotencyKey = nonEmpty(
      payload.idempotencyKey,
      'STORE_DEVICE_PRINT_IDEMPOTENCY_REQUIRED',
      'idempotencyKey',
    )
    const copies = normalizeCopies(payload.copies)

    const projection = await projector({
      branchId,
      taxDocumentId: normalizedTaxDocumentId,
    })

    if (
      !ALLOWED_PURPOSE_CODES.has(projection?.document?.type)
      || !projection?.document?.title
      || Number(projection?.document?.id) !== normalizedTaxDocumentId
    ) {
      throw fail(
        'STORE_DEVICE_PRINT_PROJECTION_INVALID',
        'Output tax invoice projection is not compatible with the print job contract',
        409,
      )
    }

    const documentPurpose = {
      code: projection.document.type,
      displayName: projection.document.title,
    }

    const requestSnapshot = {
      schemaVersion: 1,
      documentPurpose,
      source: {
        type: 'TAX_DOCUMENT',
        id: normalizedTaxDocumentId,
      },
      print: {
        copies,
      },
      projection,
    }

    const job = await jobService.createJob({
      user,
      payload: {
        idempotencyKey,
        jobType: 'PRINT_DOCUMENT',
        source: 'OUTPUT_TAX_INVOICE',
        targetDeviceId: payload.targetDeviceId || null,
        targetProfileId: payload.targetProfileId || null,
        correlationId: payload.correlationId || null,
        causationId: payload.causationId || null,
        requestSnapshot,
      },
    })

    assertIdempotentJobCompatibility({
      job,
      taxDocumentId: normalizedTaxDocumentId,
      copies,
      documentPurpose,
    })

    const durableSnapshot = job?.requestSnapshot || requestSnapshot

    return {
      job,
      documentPurpose: durableSnapshot.documentPurpose,
      source: durableSnapshot.source,
      copies: Number(durableSnapshot.print?.copies || copies),
    }
  },
})

module.exports = {
  createOutputTaxInvoicePrintJobService,
}
