'use strict'

const { createDocumentPurposePrintRouteService } = require('./documentPurposePrintRouteService')
const service = createDocumentPurposePrintRouteService()

const execute = (action) => async (req, res, next) => {
  try {
    return res.json({ data: await action(req) })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  list: execute((req) => service.list({ user: req.user })),
  get: execute((req) => service.get({ user: req.user, definitionId: req.params.definitionId })),
  configure: execute((req) => service.configure({ user: req.user, definitionId: req.params.definitionId, payload: req.body })),
  disable: execute((req) => service.disable({ user: req.user, definitionId: req.params.definitionId })),
}
