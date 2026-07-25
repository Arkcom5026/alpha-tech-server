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
  let posSearchInput = null
  let runtimeLookupInput = null
  let posDetailInput = null
  let onlineSearchInput = null
  let onlineDetailInput = null
  let readyInput = null
  let readyDetailInput = null

  const controller = loadController({
    createLocalOperationalProduct: async (input) => {
      localInput = input
      return { success: true, product: { id: 101 } }
    },
    createOperationalProductFromTemplate: async (input) => {
      templateInput = input
      return { success: true, created: true, statusCode: 201, product: { id: 202 } }
    },
    findOperationalProductsForPOS: async (input) => {
      posSearchInput = input
      return [{ id: 1 }]
    },
    findOperationalProductByTemplateId: async (input) => {
      runtimeLookupInput = input
      return { success: true, exists: true }
    },
    findOperationalProductById: async (input) => {
      posDetailInput = input
      return { id: 2 }
    },
    findOperationalProductsForOnline: async (input) => {
      onlineSearchInput = input
      return [{ id: 3 }]
    },
    findOperationalProductOnlineById: async (input) => {
      onlineDetailInput = input
      return { id: 4 }
    },
    getReadyToSell: async (input) => {
      readyInput = input
      return { items: [] }
    },
    getReadyToSellStructuredDetails: async (input) => {
      readyDetailInput = input
      return { items: [] }
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
    const res = makeResponse()
    await controller.getProductsForPos(
      {
        user: { branchId: 5 },
        query: {
          searchText: 'ssd',
          take: '20',
          page: '2',
          productTypeId: '8',
          brandId: '3',
          readyOnly: 'true',
          hasPrice: 'true',
          activeOnly: 'false',
          includeInactive: '1',
          mode: 'SIMPLE',
          simpleOnly: '1',
        },
      },
      res
    )

    assert.deepEqual(posSearchInput, {
      branchId: 5,
      search: 'ssd',
      take: '20',
      page: '2',
      productTypeId: '8',
      brandId: '3',
      readyOnly: 'true',
      hasPrice: 'true',
      activeOnly: 'false',
      includeInactive: '1',
      mode: 'SIMPLE',
      simpleOnly: '1',
    })
    assert.deepEqual(res.state.payload, [{ id: 1 }])
  }

  {
    const res = makeResponse()
    await controller.getOperationalProductByTemplateId(
      { user: { branchId: 5 }, params: { templateProductId: '77' }, query: {} },
      res
    )
    assert.deepEqual(runtimeLookupInput, { branchId: 5, templateProductId: '77' })
    assert.deepEqual(res.state.payload, { success: true, exists: true })
  }

  {
    const res = makeResponse()
    await controller.getProductPosById(
      { user: { branchId: 5 }, params: { id: '12' } },
      res
    )
    assert.deepEqual(posDetailInput, { branchId: 5, productId: '12' })
    assert.deepEqual(res.state.payload, { id: 2 })
  }

  {
    const res = makeResponse()
    await controller.getProductsForOnline(
      {
        user: {},
        query: {
          branchId: '6',
          search: 'mouse',
          take: '10',
          size: '15',
          page: '1',
          productTypeId: '2',
          brandId: '4',
          readyOnly: 'true',
          hasPrice: 'true',
          mode: 'STRUCTURED',
          simpleOnly: '0',
        },
      },
      res
    )
    assert.deepEqual(onlineSearchInput, {
      branchId: 6,
      search: 'mouse',
      take: '10',
      size: '15',
      page: '1',
      productTypeId: '2',
      brandId: '4',
      readyOnly: 'true',
      hasPrice: 'true',
      mode: 'STRUCTURED',
      simpleOnly: '0',
    })
    assert.deepEqual(res.state.payload, [{ id: 3 }])
  }

  {
    const res = makeResponse()
    await controller.getProductOnlineById(
      { user: {}, query: { branchId: '6' }, params: { id: '99' } },
      res
    )
    assert.deepEqual(onlineDetailInput, { branchId: 6, productId: '99' })
    assert.deepEqual(res.state.payload, { id: 4 })
  }

  {
    const res = makeResponse()
    await controller.getReadyToSell(
      {
        user: { branchId: 5 },
        query: { q: 'abc', search: 'x', searchText: 'y', mode: 'SIMPLE', page: '2', pageSize: '25' },
      },
      res
    )
    assert.deepEqual(readyInput, {
      branchId: 5,
      q: 'abc',
      search: 'x',
      searchText: 'y',
      mode: 'SIMPLE',
      page: '2',
      pageSize: '25',
    })
    assert.deepEqual(res.state.payload, { items: [] })
  }

  {
    const res = makeResponse()
    await controller.getReadyToSellStructuredDetails(
      { user: { branchId: 5 }, params: { productId: '45' }, query: { q: 'SN001' } },
      res
    )
    assert.deepEqual(readyDetailInput, { branchId: 5, productId: '45', q: 'SN001' })
    assert.deepEqual(res.state.payload, { items: [] })
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
