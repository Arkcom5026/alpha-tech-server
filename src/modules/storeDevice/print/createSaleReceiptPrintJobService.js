'use strict'

const { requireBranchAuthority } = require('../policies/storeDeviceAuthorityPolicy')
const durableJobService = require('../services/storeDeviceDurableJobService')
const {
  projectSaleReceiptPrintablePayment,
} = require('../../sales/payment/query/printable/projectSaleReceiptPrintablePaymentService')
const {
  fail,
  positiveInt,
  nonEmpty,
  normalizeCopies,
  assertIdempotentPrintJobCompatibility,
} = require('./printDocumentJobContract')
const { createLegacyDocumentPrintJobAdapter } = require('./createLegacyDocumentPrintJobAdapter')

const createSaleReceiptPrintJobService = ({
  projector = projectSaleReceiptPrintablePayment,
  jobService = durableJobService,
  createDocumentPrintJobService,
} = {}) => ({
  async execute({ user, paymentId, payload = {} }) {
    const branchId = requireBranchAuthority(user)
    const normalizedPaymentId = positiveInt(
      paymentId,
      'STORE_DEVICE_PRINT_PAYMENT_ID_INVALID',
      'paymentId',
    )
    const idempotencyKey = nonEmpty(
      payload.idempotencyKey,
      'STORE_DEVICE_PRINT_IDEMPOTENCY_REQUIRED',
      'idempotencyKey',
    )
    const copies = normalizeCopies(payload.copies)

    const projection = await projector({
      branchId,
      paymentId: normalizedPaymentId,
    })

    if (
      projection?.document?.type !== 'SALE_RECEIPT'
      || !projection?.document?.title
      || Number(projection?.document?.id) !== normalizedPaymentId
    ) {
      throw fail(
        'STORE_DEVICE_PRINT_PROJECTION_INVALID',
        'Sale receipt projection is not compatible with the print job contract',
        409,
      )
    }

    const document = {
      purpose: {
        code: projection.document.type,
        displayName: projection.document.title,
      },
      sourceType: 'PAYMENT',
      sourceId: normalizedPaymentId,
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
          source: 'SALE_RECEIPT',
        },
      })
      : await jobService.createJob({
        user,
        payload: {
          idempotencyKey,
          jobType: 'PRINT_DOCUMENT',
          source: 'SALE_RECEIPT',
          requestSnapshot: document,
        },
      })

    assertIdempotentPrintJobCompatibility({
      job,
      sourceType: 'PAYMENT',
      sourceId: normalizedPaymentId,
      copies,
      documentPurpose: document.purpose,
    })

    return {
      job,
      documentPurpose: document.purpose,
      source: 'SALE_RECEIPT',
      copies,
    }
  },
})

module.exports = {
  createSaleReceiptPrintJobService,
}
