'use strict'
const service = require('../services/storeDeviceDurableJobService')
const respond = (action, status = 200) => async (req, res) => { try { const data = await action(req); res.status(status).json({ data }) } catch (error) { res.status(error.statusCode || 500).json({ error: error.message, code: error.code || 'STORE_DEVICE_OPERATION_FAILED' }) } }
module.exports = {
  registerGateway: respond((req) => service.registerGateway({ user: req.user, payload: req.body }), 201),
  authenticateSession: respond((req) => service.authenticateSession({ user: req.user, gatewayId: req.params.gatewayId, payload: req.body }), 201),
  reconnectSession: respond((req) => service.reconnectSession({ user: req.user, gatewayId: req.params.gatewayId, sessionId: req.params.sessionId, payload: req.body })),
  heartbeat: respond((req) => service.heartbeat({ user: req.user, gatewayId: req.params.gatewayId, sessionId: req.params.sessionId })),
  disconnectSession: respond((req) => service.disconnectSession({ user: req.user, gatewayId: req.params.gatewayId, sessionId: req.params.sessionId })),
  rotateGateway: respond((req) => service.rotateGateway({ user: req.user, gatewayId: req.params.gatewayId, payload: req.body })),
  revokeGateway: respond((req) => service.revokeGateway({ user: req.user, gatewayId: req.params.gatewayId })),
  createJob: respond((req) => service.createJob({ user: req.user, payload: req.body }), 201),
  getJob: respond((req) => service.getJob({ user: req.user, jobId: req.params.jobId })),
  listJobs: respond((req) => service.listJobs({ user: req.user })),
  leaseJob: respond((req) => service.leaseJob({ user: req.user, jobId: req.params.jobId, payload: req.body }), 201),
  acknowledge: respond((req) => service.acknowledgeOrProgress({ user: req.user, leaseId: req.params.leaseId, payload: req.body, acknowledge: true })),
  progress: respond((req) => service.acknowledgeOrProgress({ user: req.user, leaseId: req.params.leaseId, payload: req.body, acknowledge: false })),
  complete: respond((req) => service.complete({ user: req.user, leaseId: req.params.leaseId, payload: req.body, status: 'SUCCEEDED' })),
  fail: respond((req) => service.complete({ user: req.user, leaseId: req.params.leaseId, payload: req.body, status: 'FAILED' })),
  retry: respond((req) => service.retry({ user: req.user, jobId: req.params.jobId, payload: req.body }), 201),
  diagnostics: respond((req) => service.diagnostics({ user: req.user })),
}
