'use strict'

const REQUIRED_METHODS = [
  'createDraft',
  'findReceipt',
  'findDraftItemByIdempotencyKey',
  'updateDraftItem',
  'createDraftItem',
  'deleteDraftItem',
  'transaction',
  'findReceiptForUpdate',
  'listReceiptItems',
  'listLotBarcodes',
  'listReceiptMovements',
  'increaseStockBalance',
  'createLotBarcode',
  'finalizeReceipt',
]

const assertQuickReceiptRepository = (repository) => {
  if (!repository || typeof repository !== 'object') {
    throw new TypeError('quick receipt repository is required')
  }

  const missingMethods = REQUIRED_METHODS.filter(
    (methodName) => typeof repository[methodName] !== 'function'
  )

  if (missingMethods.length > 0) {
    throw new TypeError(
      `quick receipt repository is missing methods: ${missingMethods.join(', ')}`
    )
  }

  return repository
}

module.exports = {
  QUICK_RECEIPT_REPOSITORY_METHODS: Object.freeze([...REQUIRED_METHODS]),
  assertQuickReceiptRepository,
}
