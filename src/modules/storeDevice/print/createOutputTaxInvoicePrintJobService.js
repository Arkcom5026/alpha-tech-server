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
  assertIdempotentPrintJobCompatibility,
} = require('./printDocumentJobContract')
const { createLegacyDocumentPrintJobAdapter } = require('./createLegacyDocumentPrintJobAdapter')

const ALLOWED_PURPOSE_CODES = new Set([
  'SHORT_TAX_INVOICE',
  'FULL_TAX_INVOICE',
])

const createOutputTaxInvoicePrintJobService = ({
  projector = projectOutputTaxPrintableDocument,
  jobService = durableJobService,
  createDocumentPrintJobService,
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

    const document = {
      purpose: {
        code: projection.document.type,
        displayName: projection.document.title,
      },
      sourceType: 'TAX_DOCUMENT',
      sourceId: normalizedTaxDocumentId,
      copies,
      projection,
    }

    const job = createDocumentPrintJobService
      ? await createLegacyDocumentPrintJobAdapter({
        createDocumentPrintJobService,
      }).execute({
        user,
        document,
        payload: {
          idempotencyKey,
          source: 'OUTPUT_TAX_INVOICE',
        },
      })
      : await jobService.createJob({
        user,
        payload: {
          idempotencyKey,
          jobType: 'PRINT_DOCUMENT',
          source: 'OUTPUT_TAX_INVOICE',
          requestSnapshot: document,
        },
      })

    assertIdempotentPrintJobCompatibility({
      job,
      sourceType: 'TAX_DOCUMENT',
      sourceId: normalizedTaxDocumentId,
      copies,
      documentPurpose: document.purpose,
    })

    const durableSnapshot = job?.requestSnapshot || document

    return {
      job,
      documentPurpose: durableSnapshot.documentPurpose || durableSnapshot.purpose,
      source: durableSnapshot.source,
      copies: Number(durableSnapshot.print?.copies || durableSnapshot.copies || copies),
    }
  },
})

module.exports = {
  createOutputTaxInvoicePrintJobService,
}
