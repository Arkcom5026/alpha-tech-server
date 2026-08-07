'use strict'

const { requireBranchAuthority } = require('../policies/storeDeviceAuthorityPolicy')
const durableJobService = require('../services/storeDeviceDurableJobService')
const {
  projectOutputTaxPrintableDocument,
} = require('../../tax/documents/print/projectOutputTaxPrintableDocumentService')
const {
  fail,
  positiveInt,
  nonEmpty,
  normalizeCopies,
  createPrintRequestSnapshot,
  assertIdempotentPrintJobCompatibility,
} = require('./printDocumentJobContract')

const ALLOWED_PURPOSE_CODES = new Set([
  'SHORT_TAX_INVOICE',
  'FULL_TAX_INVOICE',
])

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

    const requestSnapshot = createPrintRequestSnapshot({
      documentPurpose,
      sourceType: 'TAX_DOCUMENT',
      sourceId: normalizedTaxDocumentId,
      copies,
      projection,
    })

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

    assertIdempotentPrintJobCompatibility({
      job,
      sourceType: 'TAX_DOCUMENT',
      sourceId: normalizedTaxDocumentId,
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
