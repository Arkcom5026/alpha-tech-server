'use strict'

const {
  createOutputTaxInvoicePrintJobService,
} = require('./createOutputTaxInvoicePrintJobService')

const service = createOutputTaxInvoicePrintJobService()

const createOutputTaxInvoicePrintJob = async (req, res) => {
  try {
    const data = await service.execute({
      user: req.user,
      taxDocumentId: req.params.taxDocumentId,
      payload: req.body || {},
    })

    return res.status(201).json({ data })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message,
      code: error.code || 'STORE_DEVICE_PRINT_JOB_FAILED',
    })
  }
}

module.exports = {
  createOutputTaxInvoicePrintJob,
}
