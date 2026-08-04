'use strict'

const repository = require('../repositories/storeDeviceRegistryRepository')
const { DEVICE_KINDS, CONNECTION_STATES, sanitizeCapabilities } = require('../contracts/storeDeviceRegistryAuthority')
const { requireBranchAuthority } = require('../policies/storeDeviceAuthorityPolicy')

const fail = (code, message, statusCode = 400) => Object.assign(new Error(message), { code, statusCode })
const text = (value, field) => {
  const result = String(value || '').trim()
  if (!result) throw fail('STORE_DEVICE_INPUT_INVALID', `${field} is required`)
  return result
}

const requireDevice = async (branchId, deviceId) => {
  const device = await repository.find(branchId, text(deviceId, 'deviceId'))
  if (!device) throw fail('STORE_DEVICE_NOT_FOUND', 'Device not found for branch', 404)
  return device
}

const register = async ({ user, payload = {} }) => {
  const branchId = requireBranchAuthority(user)
  const deviceId = text(payload.deviceId, 'deviceId')
  const gatewayId = text(payload.gatewayId, 'gatewayId')
  const kind = text(payload.kind, 'kind')
  if (!DEVICE_KINDS.includes(kind)) throw fail('STORE_DEVICE_KIND_UNSUPPORTED', `Unsupported device kind: ${kind}`)

  const existing = await repository.find(branchId, deviceId)
  if (existing?.gatewayId !== undefined && existing.gatewayId !== gatewayId) {
    throw fail('STORE_DEVICE_GATEWAY_REASSIGNMENT_DENIED', 'Device gateway authority cannot be reassigned', 409)
  }
  if (existing?.revokedAt) throw fail('STORE_DEVICE_REVOKED', 'Revoked device cannot be registered again', 409)

  return repository.register({
    branchId,
    deviceId,
    gatewayId,
    name: text(payload.name, 'name'),
    kind,
    connectionState: CONNECTION_STATES.includes(payload.connectionState) ? payload.connectionState : 'UNKNOWN',
    capabilities: sanitizeCapabilities(payload.capabilities),
    transportKind: payload.transportKind ? String(payload.transportKind) : null,
    adapterKind: payload.adapterKind ? String(payload.adapterKind) : null,
    metadata: payload.metadata || {},
  })
}

const list = ({ user }) => repository.list(requireBranchAuthority(user))

const detail = ({ user, deviceId }) => requireDevice(requireBranchAuthority(user), deviceId)

const rename = async ({ user, deviceId, payload = {} }) => {
  const branchId = requireBranchAuthority(user)
  const current = await requireDevice(branchId, deviceId)
  if (current.revokedAt) throw fail('STORE_DEVICE_REVOKED', 'Revoked device cannot be renamed', 409)
  return repository.rename(branchId, current.deviceId, text(payload.name, 'name'))
}

const assignWorkstation = async ({ user, deviceId, payload = {} }) => {
  const branchId = requireBranchAuthority(user)
  const current = await requireDevice(branchId, deviceId)
  if (current.revokedAt) throw fail('STORE_DEVICE_REVOKED', 'Revoked device cannot be assigned', 409)
  return repository.assignWorkstation(branchId, current.deviceId, text(payload.workstationId, 'workstationId'))
}

const revoke = async ({ user, deviceId }) => {
  const branchId = requireBranchAuthority(user)
  const current = await requireDevice(branchId, deviceId)
  if (current.revokedAt) return current
  return repository.revoke(branchId, current.deviceId)
}

module.exports = { register, list, detail, rename, assignWorkstation, revoke }
