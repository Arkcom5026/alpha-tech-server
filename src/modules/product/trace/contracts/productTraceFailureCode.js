const ProductTraceFailureCode = Object.freeze({
  BARCODE_REQUIRED: 'BARCODE_REQUIRED',
  BARCODE_INVALID: 'BARCODE_INVALID',
  BRANCH_CONTEXT_REQUIRED: 'BRANCH_CONTEXT_REQUIRED',
  STOCK_ITEM_NOT_FOUND: 'STOCK_ITEM_NOT_FOUND',
  STOCK_ITEM_OUT_OF_SCOPE: 'STOCK_ITEM_OUT_OF_SCOPE',
  PRODUCT_TRACE_FORBIDDEN: 'PRODUCT_TRACE_FORBIDDEN',
  TRACE_DATA_INCOMPLETE: 'TRACE_DATA_INCOMPLETE',
  PRODUCT_TRACE_INTERNAL_ERROR: 'PRODUCT_TRACE_INTERNAL_ERROR',
})

class ProductTraceError extends Error {
  constructor({ code, message, status = 400, details = null, cause = null }) {
    super(message)
    this.name = 'ProductTraceError'
    this.code = code
    this.status = status
    this.details = details
    this.cause = cause
  }
}

module.exports = {
  ProductTraceFailureCode,
  ProductTraceError,
}
