'use strict'

const { prisma } = require('../../../../lib/prisma')

const includeGateway = { sessions: { orderBy: { createdAt: 'desc' }, take: 1 } }

const findGateway = (branchId, gatewayId) => prisma.storeDeviceGateway.findFirst({ where: { branchId, gatewayId }, include: includeGateway })
const findSession = (branchId, sessionId) => prisma.storeDeviceGatewaySession.findFirst({ where: { branchId, sessionId } })
const findJob = (branchId, jobId) => prisma.storeDeviceJob.findFirst({ where: { branchId, jobId }, include: { leases: { include: { result: true }, orderBy: { attemptNumber: 'desc' } }, results: true } })
const findLease = (branchId, leaseId) => prisma.storeDeviceJobLease.findFirst({ where: { branchId, leaseId }, include: { job: true, gateway: true, session: true, result: true } })
const listJobs = (branchId) => prisma.storeDeviceJob.findMany({ where: { branchId }, orderBy: { requestedAt: 'desc' }, take: 100 })

const createOrReadJob = ({ branchId, jobId, idempotencyKey, jobType, source, targetDeviceId, targetProfileId, requestSnapshot, correlationId, causationId }) =>
  prisma.storeDeviceJob.upsert({
    where: { branchId_idempotencyKey: { branchId, idempotencyKey } },
    create: { branchId, jobId, idempotencyKey, jobType, source, targetDeviceId, targetProfileId, requestSnapshot, correlationId, causationId },
    update: {},
  })

const createLeaseAtomically = ({ branchId, job, gateway, session, leaseId, expiresAt }) =>
  prisma.$transaction(async (tx) => {
    const now = new Date()
    const current = await tx.storeDeviceJob.findFirst({ where: { id: job.id, branchId } })
    if (!current || ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(current.status)) return null
    const existing = await tx.storeDeviceJobLease.findFirst({ where: { jobId: job.id, status: { in: ['OFFERED', 'ACKNOWLEDGED'] }, expiresAt: { gt: now } } })
    if (existing) return existing
    const attempt = await tx.storeDeviceJobLease.count({ where: { jobId: job.id } }) + 1
    const lease = await tx.storeDeviceJobLease.create({ data: { branchId, jobId: job.id, gatewayId: gateway.id, sessionId: session.id, leaseId, attemptNumber: attempt, expiresAt } })
    await tx.storeDeviceJob.update({ where: { id: job.id }, data: { status: 'LEASED' } })
    return lease
  })

const updateLease = (branchId, leaseId, gatewayId, sessionId, data) => prisma.storeDeviceJobLease.updateMany({ where: { branchId, leaseId, gatewayId, sessionId, status: { in: ['OFFERED', 'ACKNOWLEDGED'] }, expiresAt: { gt: new Date() } }, data })
const updateSession = (branchId, gatewayId, sessionId, data) => prisma.storeDeviceGatewaySession.updateMany({ where: { branchId, gatewayId, sessionId, state: { notIn: ['REVOKED', 'EXPIRED'] } }, data })
const updateGateway = (branchId, gatewayId, data) => prisma.storeDeviceGateway.updateMany({ where: { branchId, gatewayId, enrollmentState: { not: 'REVOKED' } }, data })
const revokeGateway = (branchId, gatewayId) => prisma.$transaction(async (tx) => {
  const now = new Date()
  const gateway = await tx.storeDeviceGateway.updateMany({ where: { branchId, gatewayId, enrollmentState: { not: 'REVOKED' } }, data: { enrollmentState: 'REVOKED', runtimeState: 'OFFLINE', revokedAt: now } })
  if (!gateway.count) return null
  await tx.storeDeviceGatewaySession.updateMany({ where: { branchId, gateway: { gatewayId } }, data: { state: 'REVOKED', revokedAt: now, disconnectedAt: now } })
  return { gatewayId, revokedAt: now }
})
const createResultOnce = ({ branchId, job, lease, gateway, session, resultId, status, adapterEvidence, transportEvidence, resultSnapshot, errorMetadata }) => prisma.$transaction(async (tx) => {
  const existing = await tx.storeDeviceJobResult.findFirst({ where: { leaseId: lease.id, branchId } })
  if (existing) return { result: existing, replayed: true }
  const result = await tx.storeDeviceJobResult.create({ data: { branchId, jobId: job.id, leaseId: lease.id, gatewayId: gateway.id, sessionId: session.id, resultId, status, adapterEvidence, transportEvidence, resultSnapshot, errorMetadata, executedAt: new Date() } })
  await tx.storeDeviceJobLease.update({ where: { id: lease.id }, data: { status: status === 'SUCCEEDED' ? 'COMPLETED' : 'FAILED', completedAt: status === 'SUCCEEDED' ? new Date() : null, failedAt: status === 'FAILED' ? new Date() : null } })
  await tx.storeDeviceJob.update({ where: { id: job.id }, data: { status, completedAt: status === 'SUCCEEDED' ? new Date() : null, failedAt: status === 'FAILED' ? new Date() : null, cancelledAt: status === 'CANCELLED' ? new Date() : null } })
  return { result, replayed: false }
})

module.exports = { prisma, findGateway, findSession, findJob, findLease, listJobs, createOrReadJob, createLeaseAtomically, updateLease, updateSession, updateGateway, revokeGateway, createResultOnce }
