'use strict'

const { LegacyQuickReceiptRepository } = require('./quickReceiptRepository')
const { LegacyQuickReceiptService } = require('./quickReceiptService')

const getLegacyQuickReceiptDb = (req) => {
  if (req?.app?.locals?.knex) return req.app.locals.knex

  try { return require('../../../../../db') } catch {}
  try { return require('../../../../../../db') } catch {}

  return null
}

const createLegacyQuickReceiptService = (req, options) => {
  const repository = new LegacyQuickReceiptRepository(getLegacyQuickReceiptDb(req))
  return new LegacyQuickReceiptService(repository, options)
}

module.exports = {
  createLegacyQuickReceiptService,
  getLegacyQuickReceiptDb,
}
