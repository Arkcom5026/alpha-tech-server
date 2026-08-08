'use strict'

const { ROUTE_STATUSES, requireBranchId, requireCapability, fail } = require('./printRouteContract')

const deviceSupportsCapability = (device, capability) => {
  if (capability === 'PRINT') return device.capabilities.print === true
  if (capability === 'CUT') return device.capabilities.cut === true
  return false
}

const isReady = (device) => device.connectionState === 'ONLINE'

const resolvePrintRoute = ({ storeDeviceRegistryAuthority, branchId, requiredCapability = 'PRINT' }) => {
  const normalizedBranchId = requireBranchId(branchId)
  const capability = requireCapability(requiredCapability)

  const devices = storeDeviceRegistryAuthority.list(normalizedBranchId)
  const printer = devices.find((device) => device.kind === 'PRINTER')

  if (!printer) {
    throw fail('NO_DEVICE_FOUND', ROUTE_STATUSES[1])
  }

  if (!isReady(printer)) {
    throw fail('DEVICE_NOT_READY', ROUTE_STATUSES[2])
  }

  if (!deviceSupportsCapability(printer, capability)) {
    throw fail('CAPABILITY_MISMATCH', ROUTE_STATUSES[3])
  }

  return Object.freeze({
    routeStatus: ROUTE_STATUSES[0],
    target: Object.freeze({
      type: 'DEVICE',
      deviceId: printer.deviceId,
      capability,
    }),
  })
}

module.exports = { resolvePrintRoute }
