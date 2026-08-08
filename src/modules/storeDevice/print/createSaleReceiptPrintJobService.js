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
  createPrintRequestSnapshot,
  assertIdempotentPrintJobCompatibility,
} = require('./printDocumentJobContract')
const { resolvePrintJobRouting } = require('./resolvePrintJobRouting')

const createSaleReceiptPrintJobService = ({
  projector = projectSaleReceiptPrintablePayment,
  jobService = durableJobService,
  routeResolver = null,
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

    const documentPurpose = {
      code: projection.document.type,
      displayName: projection.document.title,
    }

    const routing = await resolvePrintJobRouting({
      routeResolver,
      branchId,
      documentPurposeCode: documentPurpose.code,
      requestedCopies: payload.copies,
      legacyTargetDeviceId: payload.targetDeviceId,
      legacyTargetProfileId: payload.targetProfileId,
    })
    const copies = routing.copies

    const requestSnapshot = createPrintRequestSnapshot({
      documentPurpose,
      sourceType: 'PAYMENT',
      sourceId: normalizedPaymentId,
      copies,
      projection,
      routeSnapshot: routing.routeSnapshot,
    })

    const job = await jobService.createJob({
      user,
      payload: {
        idempotencyKey,
        jobType: 'PRINT_DOCUMENT',
        source: 'SALE_RECEIPT',
        targetDeviceId: routing.targetDeviceId,
        targetProfileId: routing.targetProfileId,
        correlationId: payload.correlationId || null,
        causationId: payload.causationId || null,
        requestSnapshot,
      },
    })

    assertIdempotentPrintJobCompatibility({
      job,
      sourceType: 'PAYMENT',
      sourceId: normalizedPaymentId,
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
  createSaleReceiptPrintJobService,
}
