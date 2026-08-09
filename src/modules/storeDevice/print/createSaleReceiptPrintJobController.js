'use strict'

const {
  createSaleReceiptPrintJobService,
} = require('./createSaleReceiptPrintJobService')
const { createResolveConfiguredPrintRouteService } = require('../../print-routing/resolveConfiguredPrintRouteService')

const service = createSaleReceiptPrintJobService({
  routeResolver: createResolveConfiguredPrintRouteService(),
})

const createSaleReceiptPrintJob = async (req, res) => {
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

module.exports = {
  createSaleReceiptPrintJob,
}
