'use strict'

const {
  createDeliveryNotePrintJobService,
} = require('./createDeliveryNotePrintJobService')
const { createResolveConfiguredPrintRouteService } = require('../../print-routing/resolveConfiguredPrintRouteService')

const service = createDeliveryNotePrintJobService({
  routeResolver: createResolveConfiguredPrintRouteService(),
})

const createDeliveryNotePrintJob = async (req, res) => {
  try {
    const data = await service.execute({
      user: req.user,
      saleId: req.params.saleId,
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
  createDeliveryNotePrintJob,
}
