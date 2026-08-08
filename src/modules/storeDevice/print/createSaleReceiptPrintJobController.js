'use strict'

const {
  createSaleReceiptPrintJobService,
} = require('./createSaleReceiptPrintJobService')

const createSaleReceiptPrintJobController = ({
  service = createSaleReceiptPrintJobService(),
} = {}) => async (req, res) => {
  try {
    const data = await service.execute({
      user: req.user,
      paymentId: req.params.paymentId,
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

const createSaleReceiptPrintJob = createSaleReceiptPrintJobController()

module.exports = {
  createSaleReceiptPrintJob,
  createSaleReceiptPrintJobController,
}
