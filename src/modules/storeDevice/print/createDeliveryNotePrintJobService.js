'use strict'

const { requireBranchAuthority } = require('../policies/storeDeviceAuthorityPolicy')
const durableJobService = require('../services/storeDeviceDurableJobService')
const {
  projectSaleDeliveryNote,
} = require('../../sales/documents/print/projectSaleDeliveryNoteService')
const { createLegacyDocumentPrintJobAdapter } = require('./createLegacyDocumentPrintJobAdapter')
const {
  positiveInt,
  nonEmpty,
  normalizeCopies,
  fail,
  createPrintRequestSnapshot,
  assertIdempotentPrintJobCompatibility,
} = require('./printDocumentJobContract')

const createDeliveryNotePrintJobService = ({
  projector = projectSaleDeliveryNote,
  jobService = durableJobService,
  createDocumentPrintJobService,
} = {}) => {
  const unifiedAdapter = createLegacyDocumentPrintJobAdapter({
    createDocumentPrintJobService,
  })

  return {
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
      const copies = normalizeCopies(payload.copies)

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

      const requestSnapshot = createPrintRequestSnapshot({
        documentPurpose,
        sourceType: 'SALE',
        sourceId: normalizedSaleId,
        copies,
        projection,
      })

      const job = await unifiedAdapter.execute({
        user,
        document: {
          ...projection.document,
          sourceType: 'SALE',
          sourceId: normalizedSaleId,
          requestSnapshot,
        },
        payload: {
          ...payload,
          idempotencyKey,
          source: 'SALE_DELIVERY_NOTE',
        },
      })

      assertIdempotentPrintJobCompatibility({
        job,
        sourceType: 'SALE',
        sourceId: normalizedSaleId,
        copies,
        documentPurpose,
      })

      return {
        job,
        documentPurpose: documentPurpose,
        source: 'SALE_DELIVERY_NOTE',
        copies,
      }
    },
  }
}

module.exports = {
  createDeliveryNotePrintJobService,
}
