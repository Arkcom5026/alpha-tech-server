'use strict'

const ROUTE_STATUSES = Object.freeze([
  'RESOLVED',
  'NO_DEVICE_FOUND',
  'DEVICE_NOT_READY',
  'CAPABILITY_MISMATCH',
])

const fail = (code, message) => Object.assign(new Error(message), { code })

const requireBranchId = (value) => {
  const branchId = Number(value)
  if (!Number.isInteger(branchId) || branchId <= 0) {
    throw fail('PRINT_ROUTE_BRANCH_REQUIRED', 'branchId must be a positive integer')
  }
  return branchId
}

const requireCapability = (value) => {
  const capability = String(value || '').trim()
  if (!capability) throw fail('PRINT_ROUTE_CAPABILITY_REQUIRED', 'requiredCapability is required')
  return capability
}

module.exports = {
  ROUTE_STATUSES,
  requireBranchId,
  requireCapability,
  fail,
}
