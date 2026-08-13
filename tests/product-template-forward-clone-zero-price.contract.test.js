'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const priceAuthorityPolicy = require('../src/modules/product/pricing/policies/priceAuthorityPolicy')
const {
  assertForwardClonePriceSnapshot,
  cloneTemplateBranchPrice,
} = require('../src/modules/product/templateClone/services/productTemplateCloneService')

const actor = {
  branchId: 5,
  employeeId: 162,
  role: 'OWNER',
  v2Role: 'OWNER',
}

const zeroSnapshot = {
  costPrice: 0,
  priceRetail: 0,
  priceWholesale: 0,
  priceTechnician: 0,
  priceOnline: 0,
}

const run = async () => {
  const controllerSource = fs.readFileSync(
    path.resolve(__dirname, '../src/modules/product/templateClone/controllers/productTemplateCloneController.js'),
    'utf8'
  )
  assert.match(controllerSource, /req\.employee\?\.v2Role\s*\|\|[\s\S]*req\.employee\?\.role/)
  assert.match(controllerSource, /role:\s*effectiveRole/)

  assert.doesNotThrow(() => assertForwardClonePriceSnapshot({
    actor,
    payload: zeroSnapshot,
  }))

  assert.throws(
    () => priceAuthorityPolicy.assertPricePayload({ actor, payload: zeroSnapshot }),
    (error) => error?.code === 'ZERO_PRICE_REQUIRES_EXPLICIT_POLICY'
  )

  assert.throws(
    () => assertForwardClonePriceSnapshot({
      actor,
      payload: { costPrice: -1 },
    }),
    (error) => error?.code === 'NEGATIVE_PRICE_NOT_ALLOWED'
  )

  assert.throws(
    () => assertForwardClonePriceSnapshot({
      actor,
      payload: { costPrice: 'not-a-number' },
    }),
    (error) => error?.code === 'INVALID_PRICE_VALUE'
  )

  let createdPayload = null
  const db = {
    branchPrice: {
      create: async ({ data }) => {
        createdPayload = data
        return { id: 999, ...data }
      },
    },
  }

  const sourcePrice = {
    ...zeroSnapshot,
    effectiveDate: null,
    expiredDate: null,
    isActive: true,
  }

  const result = await cloneTemplateBranchPrice({
    productId: 4207,
    branchId: 5,
    employeeId: 162,
    role: 'OWNER',
    v2Role: 'OWNER',
    sourcePrice,
    db,
  })

  assert.strictEqual(result.id, 999)
  assert.strictEqual(createdPayload.productId, 4207)
  assert.strictEqual(createdPayload.branchId, 5)
  assert.strictEqual(createdPayload.updatedBy, 162)
  assert.strictEqual(createdPayload.costPrice, 0)
  assert.strictEqual(createdPayload.priceRetail, 0)
  assert.strictEqual(createdPayload.priceWholesale, 0)
  assert.strictEqual(createdPayload.priceTechnician, 0)
  assert.strictEqual(createdPayload.priceOnline, 0)
  assert.strictEqual(createdPayload.note, 'Cloned from Product Template')

  console.log('PASS product-template-forward-clone-zero-price.contract.test.js')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
