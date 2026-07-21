const {
  ProductTraceFailureCode,
  ProductTraceError,
} = require('../contracts/productTraceFailureCode')
const {
  validateTraceLookup,
  validateBranchContext,
} = require('../validators/productTraceValidator')
const { getProductTraceByLookup } = require('../services/productTraceService')

const getProductTraceByBarcode = async (req, res) => {
  try {
    const lookup = validateTraceLookup(req.params?.barcode)
    const branchId = validateBranchContext(req.user?.branchId)

    const trace = await getProductTraceByLookup({
      lookup,
      branchId,
      actor: req.user,
    })

    return res.status(200).json({ ok: true, data: trace })
  } catch (error) {
    if (error instanceof ProductTraceError) {
      return res.status(error.status).json({
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details || undefined,
        },
      })
    }

    console.error('[productTrace] getProductTraceByBarcode failed', {
      reqId: req.id || null,
      barcode: req.params?.barcode || null,
      branchId: req.user?.branchId || null,
      message: error?.message,
      stack: error?.stack,
    })

    return res.status(500).json({
      ok: false,
      error: {
        code: ProductTraceFailureCode.PRODUCT_TRACE_INTERNAL_ERROR,
        message: 'ไม่สามารถโหลดประวัติสินค้าได้',
      },
    })
  }
}

module.exports = {
  getProductTraceByBarcode,
}
