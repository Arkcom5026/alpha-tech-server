'use strict'

const { createPrinterProfileService } = require('./printerProfileService')
const service = createPrinterProfileService()

const handle = (action, status = 200) => async (req, res, next) => {
  try {
    return res.status(status).json({ data: await action(req) })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  list: handle((req) => service.list({ user: req.user })),
  create: handle((req) => service.create({ user: req.user, payload: req.body }), 201),
  update: handle((req) => service.update({ user: req.user, profileId: req.params.profileId, payload: req.body })),
}
