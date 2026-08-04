'use strict'

const crypto = require('node:crypto')
const repository = require('../repositories/storeDeviceRepository')
const { requireBranchAuthority, assertActiveGatewaySession, assertJobMutable, assertRetryable } = require('../policies/storeDeviceAuthorityPolicy')
const fail = (code, message, statusCode = 400) => Object.assign(new Error(message), { code, statusCode })
const id = (prefix) => `${prefix}_${crypto.randomUUID()}`

const gatewaySession = async (branchId, gatewayId, sessionId) => {
  const [gateway, session] = await Promise.all([repository.findGateway(branchId, gatewayId), repository.findSession(branchId, sessionId)])
  assertActiveGatewaySession({ gateway, session, branchId })
  return { gateway, session }
}

const registerGateway = async ({ user, payload }) => {
  const branchId = requireBranchAuthority(user)
  if (!payload.gatewayId || !Number.isInteger(Number(payload.credentialVersion))) throw fail('STORE_DEVICE_GATEWAY_INPUT_INVALID', 'gatewayId and credentialVersion are required')
  const existing = await repository.findGateway(branchId, String(payload.gatewayId))
  if (existing?.enrollmentState === 'REVOKED' || existing?.revokedAt) throw fail('STORE_DEVICE_GATEWAY_SESSION_INACTIVE', 'Revoked gateway cannot be registered', 409)
  return repository.prisma.storeDeviceGateway.upsert({ where: { branchId_gatewayId: { branchId, gatewayId: String(payload.gatewayId) } }, create: { branchId, gatewayId: String(payload.gatewayId), credentialVersion: Number(payload.credentialVersion), enrollmentState: 'ENROLLED', runtimeState: 'OFFLINE', capabilitiesSnapshot: payload.capabilitiesSnapshot, platformSnapshot: payload.platformSnapshot }, update: { credentialVersion: Number(payload.credentialVersion), capabilitiesSnapshot: payload.capabilitiesSnapshot, platformSnapshot: payload.platformSnapshot } })
}
const authenticateSession = async ({ user, gatewayId, payload }) => {
  const branchId = requireBranchAuthority(user); const gateway = await repository.findGateway(branchId, gatewayId)
  if (!gateway) throw fail('STORE_DEVICE_GATEWAY_NOT_FOUND', 'Gateway not found', 404)
  if (gateway.enrollmentState === 'REVOKED' || gateway.revokedAt) throw fail('STORE_DEVICE_GATEWAY_SESSION_INACTIVE', 'Gateway is revoked', 403)
  return repository.prisma.storeDeviceGatewaySession.create({ data: { branchId, gatewayId: gateway.id, sessionId: id('sds'), credentialVersion: gateway.credentialVersion, challengeId: payload.challengeId || null, state: 'AUTHENTICATED', authenticatedAt: new Date(), expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null } })
}
const reconnectSession = async ({ user, gatewayId, sessionId, payload }) => {
  const branchId = requireBranchAuthority(user)
  const { gateway, session } = await gatewaySession(branchId, gatewayId, sessionId)
  const update = await repository.updateSession(branchId, gateway.id, session.sessionId, { state: 'AUTHENTICATED', authenticatedAt: new Date(), disconnectedAt: null, reconnectCursor: payload.reconnectCursor || session.reconnectCursor })
  if (!update.count) throw fail('STORE_DEVICE_GATEWAY_SESSION_INACTIVE', 'Gateway session cannot reconnect', 409)
  return repository.findSession(branchId, sessionId)
}
const heartbeat = async ({ user, gatewayId, sessionId }) => {
  const branchId = requireBranchAuthority(user)
  const { gateway, session } = await gatewaySession(branchId, gatewayId, sessionId)
  const now = new Date()
  await repository.updateGateway(branchId, gateway.gatewayId, { runtimeState: 'ONLINE', lastHeartbeatAt: now, lastAuthenticatedAt: now })
  await repository.updateSession(branchId, gateway.id, session.sessionId, { state: 'AUTHENTICATED', authenticatedAt: now })
  return { gatewayId: gateway.gatewayId, sessionId: session.sessionId, heartbeatAt: now }
}
const disconnectSession = async ({ user, gatewayId, sessionId }) => {
  const branchId = requireBranchAuthority(user)
  const { gateway, session } = await gatewaySession(branchId, gatewayId, sessionId)
  const now = new Date()
  const update = await repository.updateSession(branchId, gateway.id, session.sessionId, { state: 'DISCONNECTED', disconnectedAt: now })
  if (!update.count) throw fail('STORE_DEVICE_GATEWAY_SESSION_INACTIVE', 'Gateway session cannot disconnect', 409)
  await repository.updateGateway(branchId, gateway.gatewayId, { runtimeState: 'OFFLINE' })
  return { gatewayId: gateway.gatewayId, sessionId: session.sessionId, disconnectedAt: now }
}
const rotateGateway = async ({ user, gatewayId, payload }) => {
  const branchId = requireBranchAuthority(user)
  const gateway = await repository.findGateway(branchId, gatewayId)
  if (!gateway || gateway.enrollmentState === 'REVOKED' || gateway.revokedAt) throw fail('STORE_DEVICE_GATEWAY_SESSION_INACTIVE', 'Gateway is revoked or unavailable', 404)
  const credentialVersion = Number(payload.credentialVersion)
  if (!Number.isInteger(credentialVersion) || credentialVersion <= gateway.credentialVersion) throw fail('STORE_DEVICE_CREDENTIAL_VERSION_INVALID', 'credentialVersion must increase')
  await repository.updateGateway(branchId, gateway.gatewayId, { credentialVersion })
  return repository.findGateway(branchId, gateway.gatewayId)
}
const revokeGateway = async ({ user, gatewayId }) => {
  const branchId = requireBranchAuthority(user)
  const result = await repository.revokeGateway(branchId, gatewayId)
  if (!result) throw fail('STORE_DEVICE_GATEWAY_NOT_FOUND', 'Gateway not found or already revoked', 404)
  return result
}
const createJob = async ({ user, payload }) => {
  const branchId = requireBranchAuthority(user)
  if (!payload.idempotencyKey || !payload.jobType || !payload.source || !payload.requestSnapshot) throw fail('STORE_DEVICE_JOB_INPUT_INVALID', 'idempotencyKey, jobType, source and requestSnapshot are required')
  return repository.createOrReadJob({ branchId, jobId: id('sdj'), idempotencyKey: String(payload.idempotencyKey), jobType: payload.jobType, source: String(payload.source), targetDeviceId: payload.targetDeviceId || null, targetProfileId: payload.targetProfileId || null, requestSnapshot: payload.requestSnapshot, correlationId: payload.correlationId || null, causationId: payload.causationId || null })
}
const leaseJob = async ({ user, jobId, payload }) => {
  const branchId = requireBranchAuthority(user); const job = await repository.findJob(branchId, jobId); assertJobMutable(job)
  const { gateway, session } = await gatewaySession(branchId, payload.gatewayId, payload.sessionId)
  const expiresAt = new Date(payload.expiresAt)
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw fail('STORE_DEVICE_LEASE_EXPIRY_INVALID', 'Lease expiry must be in the future')
  const lease = await repository.createLeaseAtomically({ branchId, job, gateway, session, leaseId: id('sdl'), expiresAt })
  if (!lease) throw fail('STORE_DEVICE_JOB_TERMINAL', 'Terminal job cannot be leased', 409)
  if (lease.gatewayId !== gateway.id || lease.sessionId !== session.id) throw fail('STORE_DEVICE_LEASE_HELD', 'Job is already leased by another active gateway session', 409)
  return lease
}
const acknowledgeOrProgress = async ({ user, leaseId, payload, acknowledge }) => {
  const branchId = requireBranchAuthority(user); const { gateway, session } = await gatewaySession(branchId, payload.gatewayId, payload.sessionId)
  const update = await repository.updateLease(branchId, leaseId, gateway.id, session.id, acknowledge ? { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() } : {})
  if (!update.count) throw fail('STORE_DEVICE_LEASE_NOT_ACTIVE', 'Lease is not active', 409)
  return { leaseId, gatewayId: gateway.gatewayId, sessionId: session.sessionId, acknowledged: acknowledge, progress: payload.progress || null }
}
const complete = async ({ user, leaseId, payload, status }) => {
  const branchId = requireBranchAuthority(user); const lease = await repository.findLease(branchId, leaseId)
  if (!lease) throw fail('STORE_DEVICE_LEASE_NOT_FOUND', 'Lease not found', 404)
  const { gateway, session } = await gatewaySession(branchId, payload.gatewayId, payload.sessionId)
  if (lease.gatewayId !== gateway.id || lease.sessionId !== session.id) throw fail('STORE_DEVICE_CROSS_BRANCH_ACCESS_DENIED', 'Lease authority mismatch')
  return repository.createResultOnce({ branchId, job: lease.job, lease, gateway, session, resultId: payload.resultId || id('sdr'), status, adapterEvidence: payload.adapterEvidence || null, transportEvidence: payload.transportEvidence || null, resultSnapshot: payload.resultSnapshot || {}, errorMetadata: payload.errorMetadata || null })
}
const retry = async ({ user, jobId, payload }) => {
  const branchId = requireBranchAuthority(user)
  const job = await repository.findJob(branchId, jobId)
  assertRetryable(job)
  if (!payload.idempotencyKey) throw fail('STORE_DEVICE_RETRY_IDEMPOTENCY_REQUIRED', 'Retry requires a new idempotencyKey')
  return repository.createOrReadJob({ branchId, jobId: id('sdj'), idempotencyKey: String(payload.idempotencyKey), jobType: job.jobType, source: job.source, targetDeviceId: job.targetDeviceId, targetProfileId: job.targetProfileId, requestSnapshot: job.requestSnapshot, correlationId: job.correlationId, causationId: job.jobId })
}
const getJob = async ({ user, jobId }) => { const job = await repository.findJob(requireBranchAuthority(user), jobId); if (!job) throw fail('STORE_DEVICE_JOB_NOT_FOUND', 'Job not found', 404); return job }
const listJobs = async ({ user }) => repository.listJobs(requireBranchAuthority(user))
const diagnostics = async ({ user }) => { const branchId = requireBranchAuthority(user); const [gateways, sessions, jobs] = await Promise.all([repository.prisma.storeDeviceGateway.count({ where: { branchId } }), repository.prisma.storeDeviceGatewaySession.count({ where: { branchId } }), repository.prisma.storeDeviceJob.count({ where: { branchId } })]); return { branchId, gateways, sessions, jobs } }

module.exports = { registerGateway, authenticateSession, reconnectSession, heartbeat, disconnectSession, rotateGateway, revokeGateway, createJob, getJob, listJobs, leaseJob, acknowledgeOrProgress, complete, retry, diagnostics }
