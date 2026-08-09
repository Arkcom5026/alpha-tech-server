'use strict'

const routeRepository = require('../document-purpose/print-route/documentPurposePrintRouteRepository')
const deviceRepository = require('../storeDevice/repositories/storeDeviceRegistryRepository')
const { normalizeDocumentPurposeCode } = require('../document-purpose/shared/documentPurposeDomain')

const fail = (code, message, statusCode = 409, details) => {
  const error = Object.assign(new Error(message), { code, statusCode })
  if (details) error.details = details
  throw error
}
const positiveInt = (value, field) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) fail('PRINT_ROUTE_CONTEXT_INVALID', `${field} must be a positive integer`, 400)
  return parsed
}
const normalizeProfileCode = (value) => String(value || '').trim().normalize('NFKC').toUpperCase().replace(/[\s-]+/g, '_')
const supports = (device, capability) => device?.capabilities?.[String(capability).toLowerCase()] === true

const createResolveConfiguredPrintRouteService = ({
  routes = routeRepository,
  devices = deviceRepository,
} = {}) => ({
  async execute({ branchId, documentPurposeCode }) {
    const normalizedBranchId = positiveInt(branchId, 'branchId')
    const normalizedCode = normalizeDocumentPurposeCode(documentPurposeCode)
    const definitions = await routes.prisma.documentPurposeDefinition.findMany({
      where: { branchId: normalizedBranchId, normalizedCode },
      select: { id: true },
      take: 1,
    })
    const definitionId = definitions[0]?.id
    if (!definitionId) fail('DOCUMENT_PURPOSE_NOT_FOUND', `Document purpose ${normalizedCode} is not registered`, 404)
    const route = await routes.findByDefinition({ branchId: normalizedBranchId, definitionId })
    if (!route || !route.isActive) fail('PRINT_ROUTE_NOT_CONFIGURED', `No active print route for ${normalizedCode}`)
    if (!route.printerProfile?.isActive) fail('PRINT_PROFILE_INACTIVE', 'Configured printer profile is inactive')

    const registered = await devices.list(normalizedBranchId)
    const profileCode = route.printerProfile.normalizedCode
    const matching = registered.filter((device) => (
      device.kind === 'PRINTER'
      && !device.revokedAt
      && normalizeProfileCode(device.metadata?.printerProfileCode) === profileCode
    ))
    if (!matching.length) fail('PRINT_DEVICE_NOT_FOUND', `No registered printer matches profile ${profileCode}`)
    const ready = matching.find((device) => device.connectionState === 'ONLINE')
    if (!ready) fail('PRINT_DEVICE_NOT_READY', `No online printer matches profile ${profileCode}`)
    if (!supports(ready, route.requiredCapability)) {
      fail('PRINT_CAPABILITY_MISMATCH', `Printer does not support ${route.requiredCapability}`)
    }

    return Object.freeze({
      routeStatus: 'RESOLVED',
      routeId: route.id,
      documentPurpose: Object.freeze({
        id: route.definition.id,
        code: route.definition.normalizedCode,
        version: route.definition.currentVersion,
      }),
      printerProfile: Object.freeze({
        id: route.printerProfile.id,
        code: route.printerProfile.normalizedCode,
        manufacturer: route.printerProfile.manufacturer,
        modelName: route.printerProfile.modelName,
      }),
      targetDevice: Object.freeze({
        deviceId: ready.deviceId,
        gatewayId: ready.gatewayId,
        printerName: ready.name,
        driverName: ready.metadata?.driverName || null,
      }),
      capability: route.requiredCapability,
      copies: route.copies,
    })
  },
})

module.exports = { createResolveConfiguredPrintRouteService, normalizeProfileCode, supports }
