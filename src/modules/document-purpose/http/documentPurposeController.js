'use strict'

const { DocumentPurposeCreateService } = require('../create/documentPurposeCreateService')
const { DocumentPurposeReadService } = require('../read/documentPurposeReadService')
const { DocumentPurposeUpdateService } = require('../update/documentPurposeUpdateService')
const { DocumentPurposeLifecycleService } = require('../lifecycle/documentPurposeLifecycleService')

const httpError = (code, message, statusCode) => {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

const actorFromRequest = (req) => {
  const branchId = Number(req.user?.branchId)
  const employeeId = Number(req.user?.employeeId)
  if (!Number.isInteger(branchId) || branchId <= 0 || !Number.isInteger(employeeId) || employeeId <= 0) {
    throw httpError(
      'DOCUMENT_PURPOSE_EMPLOYEE_CONTEXT_REQUIRED',
      'Document purpose runtime requires an authenticated employee branch context',
      403,
    )
  }
  return { branchId, employeeId }
}

const branchFromRequest = (req) => {
  const branchId = Number(req.user?.branchId)
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw httpError(
      'DOCUMENT_PURPOSE_BRANCH_CONTEXT_REQUIRED',
      'Document purpose runtime requires an authenticated branch context',
      403,
    )
  }
  return branchId
}

const mutationInput = (req) => {
  const input = { ...(req.body || {}) }
  const headerKey = req.headers?.['x-idempotency-key']
  if (input.idempotencyKey == null && headerKey != null && String(headerKey).trim()) {
    input.idempotencyKey = String(headerKey).trim()
  }
  return input
}

const createDocumentPurposeController = ({
  createService = new DocumentPurposeCreateService(),
  readService = new DocumentPurposeReadService(),
  updateService = new DocumentPurposeUpdateService(),
  lifecycleService = new DocumentPurposeLifecycleService(),
} = {}) => ({
  list: async (req, res, next) => {
    try {
      const result = await readService.list({ branchId: branchFromRequest(req), query: req.query || {} })
      return res.json(result)
    } catch (error) {
      return next(error)
    }
  },

  getById: async (req, res, next) => {
    try {
      const result = await readService.getById({
        branchId: branchFromRequest(req),
        definitionId: req.params.definitionId,
      })
      return res.json(result)
    } catch (error) {
      return next(error)
    }
  },

  getByCode: async (req, res, next) => {
    try {
      const result = await readService.getByCode({
        branchId: branchFromRequest(req),
        code: req.params.code,
      })
      return res.json(result)
    } catch (error) {
      return next(error)
    }
  },

  listVersions: async (req, res, next) => {
    try {
      const result = await readService.listVersions({
        branchId: branchFromRequest(req),
        definitionId: req.params.definitionId,
      })
      return res.json(result)
    } catch (error) {
      return next(error)
    }
  },

  listEvents: async (req, res, next) => {
    try {
      const result = await readService.listEvents({
        branchId: branchFromRequest(req),
        definitionId: req.params.definitionId,
      })
      return res.json(result)
    } catch (error) {
      return next(error)
    }
  },

  create: async (req, res, next) => {
    try {
      const result = await createService.execute({ actor: actorFromRequest(req), input: mutationInput(req) })
      return res.status(201).json(result)
    } catch (error) {
      return next(error)
    }
  },

  update: async (req, res, next) => {
    try {
      const result = await updateService.execute({
        actor: actorFromRequest(req),
        definitionId: req.params.definitionId,
        input: mutationInput(req),
      })
      return res.json(result)
    } catch (error) {
      return next(error)
    }
  },

  lifecycle: async (req, res, next) => {
    try {
      const result = await lifecycleService.execute({
        actor: actorFromRequest(req),
        definitionId: req.params.definitionId,
        input: mutationInput(req),
      })
      return res.json(result)
    } catch (error) {
      return next(error)
    }
  },
})

module.exports = createDocumentPurposeController()
module.exports.createDocumentPurposeController = createDocumentPurposeController
module.exports.actorFromRequest = actorFromRequest
module.exports.branchFromRequest = branchFromRequest
module.exports.mutationInput = mutationInput
