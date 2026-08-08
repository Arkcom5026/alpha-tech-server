'use strict'

const { requireBranchAuthority } = require('../policies/storeDeviceAuthorityPolicy')
const repository = require('../repositories/storeDeviceRepository')
const durableJobService = require('../services/storeDeviceDurableJobService')

const fail = (code, message, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode })

const nonEmpty = (value, code, field) => {
  if (typeof value !== 'string' || !value.trim()) throw fail(code, `${field} is required`)
  return value.trim()
}

const assertPrintLease = async ({ user, leaseId }) => {
  const branchId = requireBranchAuthority(user)
  const lease = await repository.findLease(branchId, leaseId)
  if (!lease) throw fail('STORE_DEVICE_LEASE_NOT_FOUND', 'Lease not found', 404)
  if (!(lease.expiresAt instanceof Date) || lease.expiresAt <= new Date()) {
    throw fail('STORE_DEVICE_LEASE_EXPIRED', 'Print lease is expired', 409)
  }

  const snapshot = lease.job?.requestSnapshot
  if (
    lease.job?.jobType !== 'PRINT_DOCUMENT'
    || snapshot?.schemaVersion !== 1
    || !snapshot?.documentPurpose?.code
    || !snapshot?.source?.type
    || !snapshot?.source?.id
    || !snapshot?.projection
  ) {
    throw fail(
      'STORE_DEVICE_PRINT_EXECUTION_CONTRACT_INVALID',
      'Lease is not bound to a compatible print document job',
      409,
    )
  }

  return { branchId, lease, snapshot }
}

const createPrintDocumentExecutionService = ({ jobService = durableJobService } = {}) => ({
  async acknowledge({ user, leaseId, payload = {} }) {
    const { snapshot } = await assertPrintLease({ user, leaseId })
    const result = await jobService.acknowledgeOrProgress({
      user,
      leaseId,
      payload: {
        gatewayId: payload.gatewayId,
        sessionId: payload.sessionId,
      },
      acknowledge: true,
    })

    return {
      ...result,
      documentPurpose: snapshot.documentPurpose,
      source: snapshot.source,
    }
  },

  async complete({ user, leaseId, payload = {}, status }) {
    if (!['SUCCEEDED', 'FAILED'].includes(status)) {
      throw fail('STORE_DEVICE_PRINT_RESULT_STATUS_INVALID', 'Print result status is invalid')
    }

    const { snapshot } = await assertPrintLease({ user, leaseId })
    const resultId = nonEmpty(
      payload.resultId,
      'STORE_DEVICE_PRINT_RESULT_ID_REQUIRED',
      'resultId',
    )

    const resultSnapshot = {
      schemaVersion: 1,
      execution: {
        kind: 'PRINT_DOCUMENT',
        status,
        documentPurpose: snapshot.documentPurpose,
        source: snapshot.source,
        copies: Number(snapshot.print?.copies || 1),
      },
      gateway: payload.executionSnapshot || {},
    }

    const result = await jobService.complete({
      user,
      leaseId,
      status,
      payload: {
        gatewayId: payload.gatewayId,
        sessionId: payload.sessionId,
        resultId,
        adapterEvidence: payload.adapterEvidence || null,
        transportEvidence: payload.transportEvidence || null,
        resultSnapshot,
        errorMetadata: status === 'FAILED' ? (payload.errorMetadata || {}) : null,
      },
    })

    return {
      result,
      documentPurpose: snapshot.documentPurpose,
      source: snapshot.source,
      status,
    }
  },
})

module.exports = {
  createPrintDocumentExecutionService,
}
