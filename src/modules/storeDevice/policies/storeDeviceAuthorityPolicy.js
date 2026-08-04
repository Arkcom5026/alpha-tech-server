'use strict'

const fail = (code, message, statusCode = 403) => Object.assign(new Error(message), { code, statusCode })

const requireBranchAuthority = (user) => {
  const branchId = Number(user?.branchId)
  if (!Number.isInteger(branchId) || branchId <= 0) throw fail('STORE_DEVICE_BRANCH_AUTHORITY_REQUIRED', 'Authenticated branch authority is required', 401)
  return branchId
}

const assertActiveGatewaySession = ({ gateway, session, branchId }) => {
  if (!gateway || gateway.branchId !== branchId || !session || session.branchId !== branchId || session.gatewayId !== gateway.id) {
    throw fail('STORE_DEVICE_CROSS_BRANCH_ACCESS_DENIED', 'Gateway/session authority does not belong to this store')
  }
  if (gateway.enrollmentState === 'REVOKED' || gateway.revokedAt || session.state === 'REVOKED' || session.revokedAt || session.state === 'EXPIRED' || (session.expiresAt && session.expiresAt <= new Date())) {
    throw fail('STORE_DEVICE_GATEWAY_SESSION_INACTIVE', 'Gateway/session is revoked or expired')
  }
}

const assertJobMutable = (job) => {
  if (!job || ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(job.status)) {
    throw fail('STORE_DEVICE_JOB_TERMINAL', 'Terminal job cannot be retried or silently restored', 409)
  }
}

const assertRetryable = (job) => {
  if (!job || job.status !== 'FAILED') {
    throw fail('STORE_DEVICE_JOB_NOT_RETRYABLE', 'Only a failed job may create an explicit retry', 409)
  }
}

module.exports = { requireBranchAuthority, assertActiveGatewaySession, assertJobMutable, assertRetryable }
