'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { createDocumentPurposePrintRouteService } = require('../src/modules/document-purpose/print-route/documentPurposePrintRouteService')
const { createResolveConfiguredPrintRouteService } = require('../src/modules/print-routing/resolveConfiguredPrintRouteService')
const { createSaleReceiptPrintJobService } = require('../src/modules/storeDevice/print/createSaleReceiptPrintJobService')

const profile = {
  id: 7,
  branchId: 3,
  normalizedCode: 'EPSON_TM_T82X',
  manufacturer: 'EPSON',
  modelName: 'TM-T82X',
  isActive: true,
}
const definition = {
  id: 11,
  branchId: 3,
  code: 'SALE_RECEIPT',
  normalizedCode: 'SALE_RECEIPT',
  currentVersion: 2,
  lifecycleState: 'ACTIVE',
  metadata: { printEligible: true },
}
const configuredRoute = {
  id: 19,
  branchId: 3,
  definitionId: 11,
  printerProfileId: 7,
  requiredCapability: 'PRINT',
  copies: 2,
  isActive: true,
  definition,
  printerProfile: profile,
}

;(async () => {
  let saved
  const configurationService = createDocumentPurposePrintRouteService({
    list: async ({ branchId }) => branchId === 3 ? [configuredRoute] : [],
    findDefinition: async ({ branchId }) => branchId === 3 ? definition : null,
    findProfile: async ({ branchId }) => branchId === 3 ? profile : null,
    findByDefinition: async () => configuredRoute,
    upsert: async (input) => { saved = input; return configuredRoute },
    disable: async () => ({ ...configuredRoute, isActive: false }),
  })
  assert.deepStrictEqual(await configurationService.list({ user: { branchId: 3 } }), [configuredRoute])
  await configurationService.configure({
    user: { branchId: 3 },
    definitionId: 11,
    payload: { printerProfileId: 7, copies: 2 },
  })
  assert.strictEqual(saved.branchId, 3)
  assert.strictEqual(saved.data.printerProfileId, 7)
  await assert.rejects(
    () => configurationService.configure({ user: { branchId: 4 }, definitionId: 11, payload: { printerProfileId: 7 } }),
    (error) => error.code === 'DOCUMENT_PURPOSE_NOT_FOUND',
  )

  const registeredPrinter = {
    branchId: 3,
    deviceId: 'counter-01',
    gatewayId: 'pos-01',
    name: 'EPSON TM-T82X Receipt',
    kind: 'PRINTER',
    connectionState: 'ONLINE',
    capabilities: { print: true },
    metadata: { printerProfileCode: 'EPSON_TM_T82X', driverName: 'EPSON TM-T82X' },
    revokedAt: null,
  }
  const resolver = createResolveConfiguredPrintRouteService({
    routes: {
      prisma: { documentPurposeDefinition: { findMany: async ({ where }) => where.branchId === 3 ? [{ id: 11 }] : [] } },
      findByDefinition: async () => configuredRoute,
    },
    devices: { list: async (branchId) => branchId === 3 ? [registeredPrinter] : [] },
  })
  const resolved = await resolver.execute({ branchId: 3, documentPurposeCode: 'sale-receipt' })
  assert.strictEqual(resolved.targetDevice.deviceId, 'counter-01')
  assert.strictEqual(resolved.printerProfile.modelName, 'TM-T82X')
  assert.strictEqual(resolved.copies, 2)

  const jobService = {
    createJob: async ({ payload }) => ({ id: 88, requestSnapshot: payload.requestSnapshot, ...payload }),
  }
  const service = createSaleReceiptPrintJobService({
    routeResolver: resolver,
    jobService,
    projector: async () => ({ document: { type: 'SALE_RECEIPT', title: 'Receipt', id: 44 } }),
  })
  const created = await service.execute({
    user: { branchId: 3 },
    paymentId: 44,
    payload: { idempotencyKey: 'print-44' },
  })
  assert.strictEqual(created.job.targetDeviceId, 'counter-01')
  assert.strictEqual(created.job.targetProfileId, '7')
  assert.strictEqual(created.job.requestSnapshot.route.targetDevice.printerName, 'EPSON TM-T82X Receipt')
  assert.strictEqual(created.copies, 2)

  const routes = fs.readFileSync(path.join(__dirname, '../src/modules/document-purpose/http/documentPurposeRoutes.js'), 'utf8')
  const deviceRoutes = fs.readFileSync(path.join(__dirname, '../src/modules/storeDevice/routes/storeDeviceRoutes.js'), 'utf8')
  assert.match(routes, /put\('\/:definitionId\/print-route'/)
  assert.match(routes, /get\('\/print-routes'/)
  assert.match(deviceRoutes, /post\('\/printer-profiles'/)
  assert.match(deviceRoutes, /post\('\/devices\/:deviceId\/printer-profile'/)

  console.log('Document printer routing runtime contract: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
