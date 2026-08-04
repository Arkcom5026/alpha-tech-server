'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { createStoreDeviceRegistryService } = require('../src/modules/storeDevice/services/storeDeviceRegistryService')

const createRepository = () => {
  const records = new Map()
  const key = (branchId, deviceId) => `${branchId}:${deviceId}`
  return {
    find: async (branchId, deviceId) => records.get(key(branchId, deviceId)) || null,
    list: async (branchId) => [...records.values()].filter((item) => item.branchId === branchId),
    register: async (input) => {
      const value = { ...input, workstationId: null, revokedAt: null }
      records.set(key(input.branchId, input.deviceId), value)
      return value
    },
    rename: async (branchId, deviceId, name) => {
      const value = { ...records.get(key(branchId, deviceId)), name }
      records.set(key(branchId, deviceId), value)
      return value
    },
    assignWorkstation: async (branchId, deviceId, workstationId) => {
      const value = { ...records.get(key(branchId, deviceId)), workstationId }
      records.set(key(branchId, deviceId), value)
      return value
    },
    revoke: async (branchId, deviceId) => {
      const value = { ...records.get(key(branchId, deviceId)), connectionState: 'REVOKED', workstationId: null, revokedAt: new Date() }
      records.set(key(branchId, deviceId), value)
      return value
    },
  }
}

const service = createStoreDeviceRegistryService(createRepository())
const branch2 = { branchId: 2 }
const branch3 = { branchId: 3 }
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const deviceId = `printer-${suffix}`

test('registers lists details and manages a durable branch-owned device', async () => {
  const registered = await service.register({
    user: branch2,
    payload: {
      deviceId,
      gatewayId: 'gateway-store-2',
      name: 'Receipt Printer',
      kind: 'PRINTER',
      connectionState: 'ONLINE',
      capabilities: { print: true, cut: true },
    },
  })
  assert.equal(registered.branchId, 2)
  assert.equal(registered.capabilities.print, true)

  const listed = await service.list({ user: branch2 })
  assert.ok(listed.some((device) => device.deviceId === deviceId))

  await service.rename({ user: branch2, deviceId, payload: { name: 'Front Counter Printer' } })
  await service.assignWorkstation({ user: branch2, deviceId, payload: { workstationId: 'pos-front' } })
  const detail = await service.detail({ user: branch2, deviceId })
  assert.equal(detail.name, 'Front Counter Printer')
  assert.equal(detail.workstationId, 'pos-front')
})

test('denies cross-store detail access without leaking ownership', async () => {
  await assert.rejects(
    service.detail({ user: branch3, deviceId }),
    { code: 'STORE_DEVICE_NOT_FOUND', statusCode: 404 },
  )
})

test('prevents gateway reassignment and clears workstation on revoke', async () => {
  await assert.rejects(
    service.register({ user: branch2, payload: { deviceId, gatewayId: 'other-gateway', name: 'Other', kind: 'PRINTER' } }),
    { code: 'STORE_DEVICE_GATEWAY_REASSIGNMENT_DENIED', statusCode: 409 },
  )

  const revoked = await service.revoke({ user: branch2, deviceId })
  assert.equal(revoked.connectionState, 'REVOKED')
  assert.equal(revoked.workstationId, null)
  await assert.rejects(
    service.assignWorkstation({ user: branch2, deviceId, payload: { workstationId: 'pos-other' } }),
    { code: 'STORE_DEVICE_REVOKED', statusCode: 409 },
  )
})
