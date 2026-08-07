'use strict'

const durableJobService = require('../services/storeDeviceDurableJobService')

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const nonEmpty = (value, code, field) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw fail(code, `${field} is required`)
  }
  return value.trim()
}

const assertPrintJobSnapshot = (job) => {
  const snapshot = job?.requestSnapshot
  if (
    job?.jobType !== 'PRINT_DOCUMENT'
    || snapshot?.schemaVersion !== 1
    || typeof snapshot?.documentPurpose?.code !== 'string'
    || !snapshot.documentPurpose.code.trim()
    || typeof snapshot?.documentPurpose?.displayName !== 'string'
    || !snapshot.documentPurpose.displayName.trim()
    || typeof snapshot?.source?.type !== 'string'
    || !snapshot.source.type.trim()
    || !Number.isInteger(Number(snapshot?.source?.id))
    || Number(snapshot.source.id) <= 0
    || !Number.isInteger(Number(snapshot?.print?.copies))
    || Number(snapshot.print.copies) <= 0
    || !snapshot?.projection
  ) {
    throw fail(
      'STORE_DEVICE_PRINT_JOB_SNAPSHOT_INVALID',
      'Print job does not contain a compatible immutable execution snapshot',
      409,
    )
  }
  return snapshot
}

const createExecutionEnvelope = ({ job, lease, snapshot }) => Object.freeze({
  schemaVersion: 1,
  job: Object.freeze({
    jobId: job.jobId,
    jobType: job.jobType,
    source: job.source,
    correlationId: job.correlationId || null,
    causationId: job.causationId || null,
  }),
  lease: Object.freeze({
    leaseId: lease.leaseId,
    attemptNumber: Number(lease.attemptNumber),
    expiresAt: lease.expiresAt,
  }),
  documentPurpose: Object.freeze({
    code: snapshot.documentPurpose.code,
    displayName: snapshot.documentPurpose.displayName,
  }),
  source: Object.freeze({
    type: snapshot.source.type,
    id: Number(snapshot.source.id),
  }),
  print: Object.freeze({
    copies: Number(snapshot.print.copies),
  }),
  projection: snapshot.projection,
})

const createLeasePrintDocumentJobService = ({
  jobService = durableJobService,
} = {}) => ({
  async execute({ user, jobId, payload = {} }) {
    const normalizedJobId = nonEmpty(
      jobId,
      'STORE_DEVICE_PRINT_JOB_ID_REQUIRED',
      'jobId',
    )
    const gatewayId = nonEmpty(
      payload.gatewayId,
      'STORE_DEVICE_PRINT_GATEWAY_ID_REQUIRED',
      'gatewayId',
    )
    const sessionId = nonEmpty(
      payload.sessionId,
      'STORE_DEVICE_PRINT_SESSION_ID_REQUIRED',
      'sessionId',
    )
    const expiresAt = nonEmpty(
      payload.expiresAt,
      'STORE_DEVICE_PRINT_LEASE_EXPIRY_REQUIRED',
      'expiresAt',
    )

    const job = await jobService.getJob({ user, jobId: normalizedJobId })
    const snapshot = assertPrintJobSnapshot(job)

    const lease = await jobService.leaseJob({
      user,
      jobId: normalizedJobId,
      payload: {
        gatewayId,
        sessionId,
        expiresAt,
      },
    })

    return {
      lease,
      executionEnvelope: createExecutionEnvelope({ job, lease, snapshot }),
    }
  },
})

module.exports = {
  createLeasePrintDocumentJobService,
}
