'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const service = require('../src/modules/storeDevice/services/storeDeviceRegistryService')

const branch2 = { branchId: 2 }
const branch3 = { branchId: 3 }
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const deviceId = `printer-${suffix}`

test('registers lists details and manages a branch-owned device', async () => {
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

test('denies cross-store detail access', () => {
  assert.throws(
    () => service.detail({ user: branch3, deviceId }),
    { code: 'STORE_DEVICE_NOT_FOUND', statusCode: 404 },
  )
})

test('revokes device and clears workstation assignment', async () => {
  const revoked = await service.revoke({ user: branch2, deviceId })
  assert.equal(revoked.connectionState, 'REVOKED')
  const detail = await service.detail({ user: branch2, deviceId })
  assert.equal(detail.workstationId, null)
  assert.throws(
    () => service.assignWorkstation({ user: branch2, deviceId, payload: { workstationId: 'pos-other' } }),
    { code: 'STORE_DEVICE_REVOKED', statusCode: 400 },
  )
})
