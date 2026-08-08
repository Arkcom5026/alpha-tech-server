'use strict'

const assert = require('assert')
const { resolvePrintRoute } = require('../src/modules/storeDevice/print/routing/resolvePrintRoute')
const { createStoreDeviceRegistryAuthority } = require('../src/modules/storeDevice/contracts/storeDeviceRegistryAuthority')

const run = () => {
  const registry = createStoreDeviceRegistryAuthority()

  registry.register({
    branchId: 1,
    deviceId: 'printer-01',
    gatewayId: 'gateway-01',
    name: 'Front Printer',
    kind: 'PRINTER',
    connectionState: 'ONLINE',
    capabilities: { print: true },
  })

  const resolved = resolvePrintRoute({
    branchId: 1,
    requiredCapability: 'print',
    documentPurposeCode: 'FULL_TAX_INVOICE',
    deviceRegistry: registry,
  })

  assert.strictEqual(resolved.routeStatus, 'RESOLVED')
  assert.strictEqual(resolved.target.deviceId, 'printer-01')

  assert.throws(() => resolvePrintRoute({
    branchId: 1,
    requiredCapability: 'cut',
    documentPurposeCode: 'FULL_TAX_INVOICE',
    deviceRegistry: registry,
  }))
}

run()
