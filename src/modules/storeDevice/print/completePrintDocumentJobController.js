'use strict'

const {
  createPrintDocumentExecutionService,
} = require('./completePrintDocumentJobService')

const service = createPrintDocumentExecutionService()

const respond = (action) => async (req, res) => {
  try {
    const data = await action(req)
    return res.json({ data })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message,
      code: error.code || 'STORE_DEVICE_PRINT_EXECUTION_FAILED',
    })
  }
}

const acknowledgePrintDocumentJob = respond((req) => service.acknowledge({
  user: req.user,
  leaseId: req.params.leaseId,
  payload: req.body || {},
}))

const completePrintDocumentJob = respond((req) => service.complete({
  user: req.user,
  leaseId: req.params.leaseId,
  payload: req.body || {},
  status: 'SUCCEEDED',
}))

const failPrintDocumentJob = respond((req) => service.complete({
  user: req.user,
  leaseId: req.params.leaseId,
  payload: req.body || {},
  status: 'FAILED',
}))

module.exports = {
  acknowledgePrintDocumentJob,
  completePrintDocumentJob,
  failPrintDocumentJob,
}
