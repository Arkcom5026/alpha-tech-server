'use strict'

const { requireBranchAuthority } = require('../policies/storeDeviceAuthorityPolicy')
const durableJobService = require('../services/storeDeviceDurableJobService')
const {
  projectSaleDeliveryNote,
} = require('../../sales/documents/print/projectSaleDeliveryNoteService')
const {
  fail,
  positiveInt,
  nonEmpty,
  normalizeCopies,
  createPrintRequestSnapshot,
  assertIdempotentPrintJobCompatibility,
} = require('./printDocumentJobContract')
const { resolvePrintJobRouting } = require('./resolvePrintJobRouting')

const createDeliveryNotePrintJobService = ({
  projector = projectSaleDeliveryNote,
  jobService = durableJobService,
  routeResolver = null,
} = {}) => ({
  async execute({ user, saleId, payload = {} }) {
    const branchId = requireBranchAuthority(user)
    const normalizedSaleId = positiveInt(
      saleId,
      'STORE_DEVICE_PRINT_SALE_ID_INVALID',
      'saleId',
    )
    const idempotencyKey = nonEmpty(
      payload.idempotencyKey,
      'STORE_DEVICE_PRINT_IDEMPOTENCY_REQUIRED',
      'idempotencyKey',
    )
    const projection = await projector({
      branchId,
      saleId: normalizedSaleId,
    })

    if (
      projection?.document?.type !== 'DELIVERY_NOTE'
      || !projection?.document?.title
      || Number(projection?.document?.saleId) !== normalizedSaleId
    ) {
      throw fail(
        'STORE_DEVICE_PRINT_PROJECTION_INVALID',
        'Delivery note projection is not compatible with the print job contract',
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
      sourceType: 'SALE',
      sourceId: normalizedSaleId,
      copies,
      projection,
      routeSnapshot: routing.routeSnapshot,
    })

    const job = await jobService.createJob({
      user,
      payload: {
        idempotencyKey,
        jobType: 'PRINT_DOCUMENT',
        source: 'SALE_DELIVERY_NOTE',
        targetDeviceId: routing.targetDeviceId,
        targetProfileId: routing.targetProfileId,
        correlationId: payload.correlationId || null,
        causationId: payload.causationId || null,
        requestSnapshot,
      },
    })

    assertIdempotentPrintJobCompatibility({
      job,
      sourceType: 'SALE',
      sourceId: normalizedSaleId,
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
  createDeliveryNotePrintJobService,
}
