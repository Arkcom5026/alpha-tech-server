const Module = require('node:module')
const path = require('node:path')

const rootServicePath = path.resolve(
  __dirname,
  '../src/modules/product/services/operationalProductRuntimeService.js'
)
const rootControllerPath = path.resolve(
  __dirname,
  '../src/modules/product/controllers/operationalProductRuntimeController.js'
)
const runtimeServicePath = path.resolve(
  __dirname,
  '../src/modules/product/runtime/services/operationalProductRuntimeService.js'
)
const runtimeControllerPath = path.resolve(
  __dirname,
  '../src/modules/product/runtime/controllers/operationalProductRuntimeController.js'
)
const createCompatibilityServicePath = path.resolve(
  __dirname,
  '../src/modules/product/create/services/productCreateCompatibilityService.js'
)

const originalLoad = Module._load

Module._load = function patchedProductRuntimeContractLoader(request, parent, isMain) {
  const resolved = Module._resolveFilename(request, parent, isMain)

  // The legacy contract test reloads only the root compatibility controller.
  // Clear the capability controller too so every override set is observed.
  if (resolved === rootControllerPath) {
    delete require.cache[runtimeControllerPath]
  }

  // Project the legacy runtime-service mock into the capability-owned service path.
  if (resolved === runtimeServicePath) {
    const legacyServiceMock = require.cache[rootServicePath]?.exports
    if (legacyServiceMock) return legacyServiceMock
  }

  // Local create moved to its own compatibility service. Preserve the old
  // controller contract fixture without invoking production validation or Prisma.
  if (resolved === createCompatibilityServicePath) {
    const legacyServiceMock = require.cache[rootServicePath]?.exports
    if (legacyServiceMock?.createLocalOperationalProduct) {
      return {
        createLocalOperationalProductForLegacyRuntime:
          legacyServiceMock.createLocalOperationalProduct,
      }
    }
  }

  return originalLoad.call(this, request, parent, isMain)
}

require('./operational-product-runtime-controller.contract.test')
