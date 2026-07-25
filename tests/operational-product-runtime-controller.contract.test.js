const assert = require('node:assert/strict')
const path = require('node:path')

const servicePath = path.resolve(
  __dirname,
  '../src/modules/product/services/operationalProductRuntimeService.js'
)
const controllerPath = path.resolve(
  __dirname,
  '../src/modules/product/controllers/operationalProductRuntimeController.js'
)

const makeResponse = () => {
  const state = { statusCode: null, payload: null }
  return {
    state,
    status(code) {
      state.statusCode = code
      return this
    },
    json(payload) {
      state.payload = payload
      return this
    },
  }
}

const loadController = (serviceOverrides) => {
  delete require.cache[controllerPath]
  require.cache[servicePath] = {
    id: servicePath,
    filename: servicePath,
    loaded: true,
    exports: serviceOverrides,
    children: [],
    paths: [],
  }
  return require(controllerPath)
}

const run = async () => {
  let localInput = null
  let templateInput = null

  const controller = loadController({
    createLocalOperationalProduct: async (input) => {
      localInput = input
      return { success: true, product: { id: 101 } }
    },
    createOperationalProductFromTemplate: async (input) => {
      templateInput = input
      return { success: true, created: true, statusCode: 201, product: { id: 202 } }
    },
  })

  {
    const res = makeResponse()
    await controller.createLocalOperationalProduct(
      { user: { branchId: 7 }, body: { name: 'Local Product' } },
      res
    )

    assert.deepEqual(localInput, {
      branchId: 7,
      data: { name: 'Local Product' },
    })
    assert.equal(res.state.statusCode, 201)
    assert.deepEqual(res.state.payload, {
      success: true,
      product: { id: 101 },
    })
  }

  {
    const res = makeResponse()
    await controller.createOperationalProductFromTemplate(
      { user: { branchId: 9 }, body: { templateProductId: 44 } },
      res
    )

    assert.deepEqual(templateInput, {
      branchId: 9,
      templateProductId: 44,
    })
    assert.equal(res.state.statusCode, 201)
    assert.deepEqual(res.state.payload, {
      success: true,
      created: true,
      product: { id: 202 },
    })
    assert.equal('statusCode' in res.state.payload, false)
  }

  {
    const existingController = loadController({
      createLocalOperationalProduct: async () => ({ success: true }),
      createOperationalProductFromTemplate: async () => ({
        success: true,
        created: false,
        product: { id: 303 },
      }),
    })
    const res = makeResponse()
    await existingController.createOperationalProductFromTemplate(
      { user: { branchId: 9 }, body: { templateProductId: 44 } },
      res
    )

    assert.equal(res.state.statusCode, 200)
    assert.deepEqual(res.state.payload, {
      success: true,
      created: false,
      product: { id: 303 },
    })
  }

  {
    const localErrorController = loadController({
      createLocalOperationalProduct: async () => {
        const error = new Error('LOCAL_VALIDATION_FAILED')
        error.statusCode = 422
        error.code = 'LOCAL_VALIDATION_FAILED'
        throw error
      },
      createOperationalProductFromTemplate: async () => ({ success: true }),
    })
    const res = makeResponse()
    const originalError = console.error
    console.error = () => {}
    try {
      await localErrorController.createLocalOperationalProduct(
        { user: { branchId: 7 }, body: {} },
        res
      )
    } finally {
      console.error = originalError
    }

    assert.equal(res.state.statusCode, 422)
    assert.deepEqual(res.state.payload, {
      success: false,
      error: 'LOCAL_VALIDATION_FAILED',
    })
  }

  {
    const expectedCodes = [
      'BRANCH_ID_MISSING',
      'TEMPLATE_PRODUCT_ID_MISSING',
      'TEMPLATE_BRANCH_NOT_FOUND',
      'TEMPLATE_PRODUCT_NOT_FOUND',
      'PRODUCT_TYPE_NOT_FOUND_IN_BRANCH',
    ]

    for (const code of expectedCodes) {
      const expectedErrorController = loadController({
        createLocalOperationalProduct: async () => ({ success: true }),
        createOperationalProductFromTemplate: async () => {
          const error = new Error(code)
          error.code = code
          error.status = 400
          throw error
        },
      })
      const res = makeResponse()
      const originalError = console.error
      console.error = () => {}
      try {
        await expectedErrorController.createOperationalProductFromTemplate(
          { user: { branchId: 9 }, body: { templateProductId: 44 } },
          res
        )
      } finally {
        console.error = originalError
      }

      assert.equal(res.state.statusCode, 400)
      assert.deepEqual(res.state.payload, { success: false, error: code })
    }
  }

  {
    const unexpectedErrorController = loadController({
      createLocalOperationalProduct: async () => ({ success: true }),
      createOperationalProductFromTemplate: async () => {
        throw new Error('DATABASE_OFFLINE')
      },
    })
    const res = makeResponse()
    const originalError = console.error
    console.error = () => {}
    try {
      await unexpectedErrorController.createOperationalProductFromTemplate(
        { user: { branchId: 9 }, body: { templateProductId: 44 } },
        res
      )
    } finally {
      console.error = originalError
    }

    assert.equal(res.state.statusCode, 500)
    assert.deepEqual(res.state.payload, {
      success: false,
      error: 'CREATE_OPERATIONAL_PRODUCT_FROM_TEMPLATE_FAILED',
    })
  }

  delete require.cache[controllerPath]
  delete require.cache[servicePath]

  console.log('Operational Product Runtime Controller Contract: PASS')
}

run().catch((error) => {
  console.error('Operational Product Runtime Controller Contract: FAIL')
  console.error(error)
  process.exitCode = 1
})
