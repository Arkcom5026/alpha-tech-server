'use strict'

const service = require('../services/storeDeviceRegistryService')

const respond = (action, status = 200) => async (req, res) => {
  try {
    const data = await action(req)
    res.status(status).json({ data })
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error.message,
      code: error.code || 'STORE_DEVICE_REGISTRY_OPERATION_FAILED',
    })
  }
}

module.exports = {
  register: respond((req) => service.register({ user: req.user, payload: req.body }), 201),
  list: respond((req) => service.list({ user: req.user })),
  detail: respond((req) => service.detail({ user: req.user, deviceId: req.params.deviceId })),
  rename: respond((req) => service.rename({ user: req.user, deviceId: req.params.deviceId, payload: req.body })),
  assignWorkstation: respond((req) => service.assignWorkstation({ user: req.user, deviceId: req.params.deviceId, payload: req.body })),
  assignPrinterProfile: respond((req) => service.assignPrinterProfile({ user: req.user, deviceId: req.params.deviceId, payload: req.body })),
  revoke: respond((req) => service.revoke({ user: req.user, deviceId: req.params.deviceId })),
}
