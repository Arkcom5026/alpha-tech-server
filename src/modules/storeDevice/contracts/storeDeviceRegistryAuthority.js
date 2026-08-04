'use strict'

const DEVICE_KINDS = Object.freeze(['PRINTER', 'SCANNER', 'CASH_DRAWER', 'CUSTOMER_DISPLAY', 'SCALE', 'RFID', 'NFC', 'SIGNATURE_PAD', 'CARD_READER', 'CAMERA'])
const CONNECTION_STATES = Object.freeze(['UNKNOWN', 'ONLINE', 'OFFLINE', 'ERROR', 'REVOKED'])

const fail = (code, message) => Object.assign(new Error(message), { code })
const clone = (value) => structuredClone(value)
const scopedKey = (branchId, id) => `${branchId}:${id}`

const requireBranchId = (value) => {
  const branchId = Number(value)
  if (!Number.isInteger(branchId) || branchId <= 0) throw fail('STORE_DEVICE_BRANCH_REQUIRED', 'branchId must be a positive integer')
  return branchId
}

const requireText = (value, field) => {
  const text = String(value || '').trim()
  if (!text) throw fail('STORE_DEVICE_INPUT_INVALID', `${field} is required`)
  return text
}

const sanitizeCapabilities = (value = {}) => Object.freeze({
  print: value.print === true,
  cut: value.cut === true,
  cashDrawer: value.cashDrawer === true,
  scan: value.scan === true,
  status: value.status === true,
})

const createStoreDeviceRegistryAuthority = () => {
  const devices = new Map()
  const workstationAssignments = new Map()

  const requireDevice = (branchId, deviceId) => {
    const device = devices.get(scopedKey(branchId, deviceId))
    if (!device) throw fail('STORE_DEVICE_NOT_FOUND', 'Device not found for branch')
    return device
  }

  const register = (input = {}) => {
    const branchId = requireBranchId(input.branchId)
    const deviceId = requireText(input.deviceId, 'deviceId')
    const gatewayId = requireText(input.gatewayId, 'gatewayId')
    const kind = requireText(input.kind, 'kind')
    if (!DEVICE_KINDS.includes(kind)) throw fail('STORE_DEVICE_KIND_UNSUPPORTED', `Unsupported device kind: ${kind}`)

    const key = scopedKey(branchId, deviceId)
    const existing = devices.get(key)
    if (existing) {
      if (existing.gatewayId !== gatewayId) throw fail('STORE_DEVICE_GATEWAY_REASSIGNMENT_DENIED', 'Device gateway authority cannot be reassigned')
      return existing
    }

    const device = Object.freeze({
      branchId,
      deviceId,
      gatewayId,
      name: requireText(input.name, 'name'),
      kind,
      connectionState: CONNECTION_STATES.includes(input.connectionState) ? input.connectionState : 'UNKNOWN',
      capabilities: sanitizeCapabilities(input.capabilities),
      transportKind: input.transportKind ? String(input.transportKind) : null,
      adapterKind: input.adapterKind ? String(input.adapterKind) : null,
      metadata: Object.freeze(clone(input.metadata || {})),
      registeredAt: input.registeredAt || new Date().toISOString(),
      revokedAt: null,
    })
    devices.set(key, device)
    return device
  }

  const list = (branchId) => [...devices.values()].filter((device) => device.branchId === requireBranchId(branchId))

  const detail = ({ branchId, deviceId }) => {
    const device = requireDevice(requireBranchId(branchId), requireText(deviceId, 'deviceId'))
    return Object.freeze({ ...device, workstationId: workstationAssignments.get(scopedKey(device.branchId, device.deviceId)) || null })
  }

  const rename = ({ branchId, deviceId, name }) => {
    const current = requireDevice(requireBranchId(branchId), requireText(deviceId, 'deviceId'))
    if (current.revokedAt) throw fail('STORE_DEVICE_REVOKED', 'Revoked device cannot be renamed')
    const next = Object.freeze({ ...current, name: requireText(name, 'name') })
    devices.set(scopedKey(next.branchId, next.deviceId), next)
    return next
  }

  const assignWorkstation = ({ branchId, deviceId, workstationId }) => {
    const current = requireDevice(requireBranchId(branchId), requireText(deviceId, 'deviceId'))
    if (current.revokedAt) throw fail('STORE_DEVICE_REVOKED', 'Revoked device cannot be assigned')
    const assignment = Object.freeze({
      branchId: current.branchId,
      deviceId: current.deviceId,
      workstationId: requireText(workstationId, 'workstationId'),
    })
    workstationAssignments.set(scopedKey(current.branchId, current.deviceId), assignment.workstationId)
    return assignment
  }

  const revoke = ({ branchId, deviceId, revokedAt = new Date().toISOString() }) => {
    const current = requireDevice(requireBranchId(branchId), requireText(deviceId, 'deviceId'))
    if (current.revokedAt) return current
    const next = Object.freeze({ ...current, connectionState: 'REVOKED', revokedAt })
    devices.set(scopedKey(next.branchId, next.deviceId), next)
    workstationAssignments.delete(scopedKey(next.branchId, next.deviceId))
    return next
  }

  return Object.freeze({ register, list, detail, rename, assignWorkstation, revoke })
}

module.exports = { CONNECTION_STATES, DEVICE_KINDS, createStoreDeviceRegistryAuthority, sanitizeCapabilities }
