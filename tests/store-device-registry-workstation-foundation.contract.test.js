'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { createStoreDeviceRegistryAuthority } = require('../src/modules/storeDevice/contracts/storeDeviceRegistryAuthority')

test('registers and projects only branch-owned devices', () => {
  const authority = createStoreDeviceRegistryAuthority()
  authority.register({ branchId: 2, deviceId: 'printer-1', gatewayId: 'gw-1', name: 'Receipt 80mm', kind: 'PRINTER', capabilities: { print: true, cut: true } })
  authority.register({ branchId: 3, deviceId: 'printer-1', gatewayId: 'gw-3', name: 'Other Store', kind: 'PRINTER', capabilities: { print: true } })

  assert.equal(authority.list(2).length, 1)
  assert.equal(authority.list(3).length, 1)
  assert.equal(authority.detail({ branchId: 2, deviceId: 'printer-1' }).gatewayId, 'gw-1')
  assert.equal(authority.detail({ branchId: 2, deviceId: 'printer-1' }).capabilities.cut, true)
})

test('prevents gateway reassignment and cross-branch access', () => {
  const authority = createStoreDeviceRegistryAuthority()
  authority.register({ branchId: 2, deviceId: 'scanner-1', gatewayId: 'gw-1', name: 'Counter Scanner', kind: 'SCANNER', capabilities: { scan: true } })

  assert.throws(() => authority.register({ branchId: 2, deviceId: 'scanner-1', gatewayId: 'gw-2', name: 'Moved', kind: 'SCANNER' }), { code: 'STORE_DEVICE_GATEWAY_REASSIGNMENT_DENIED' })
  assert.throws(() => authority.detail({ branchId: 3, deviceId: 'scanner-1' }), { code: 'STORE_DEVICE_NOT_FOUND' })
})

test('assigns workstation and clears assignment when revoked', () => {
  const authority = createStoreDeviceRegistryAuthority()
  authority.register({ branchId: 2, deviceId: 'printer-1', gatewayId: 'gw-1', name: 'Receipt', kind: 'PRINTER', capabilities: { print: true } })

  const assignment = authority.assignWorkstation({ branchId: 2, deviceId: 'printer-1', workstationId: 'counter-01' })
  assert.equal(assignment.workstationId, 'counter-01')
  assert.equal(authority.detail({ branchId: 2, deviceId: 'printer-1' }).workstationId, 'counter-01')

  const revoked = authority.revoke({ branchId: 2, deviceId: 'printer-1', revokedAt: '2026-08-05T00:00:00.000Z' })
  assert.equal(revoked.connectionState, 'REVOKED')
  assert.equal(authority.detail({ branchId: 2, deviceId: 'printer-1' }).workstationId, null)
  assert.throws(() => authority.assignWorkstation({ branchId: 2, deviceId: 'printer-1', workstationId: 'counter-02' }), { code: 'STORE_DEVICE_REVOKED' })
})
