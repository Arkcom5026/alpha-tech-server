'use strict'

const {
  createLeasePrintDocumentJobService,
} = require('./leasePrintDocumentJobService')

const service = createLeasePrintDocumentJobService()

const leasePrintDocumentJob = async (req, res) => {
  try {
    const data = await service.execute({
      user: req.user,
      jobId: req.params.jobId,
      payload: req.body || {},
    })

    return res.status(201).json({ data })
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message,
      code: error.code || 'STORE_DEVICE_PRINT_LEASE_FAILED',
    })
  }
}

module.exports = {
  leasePrintDocumentJob,
}
