'use strict'

const assert = require('assert')
const { cloneBranchPrice } = require('../src/modules/product/services/productTemplateEngine/cloneBranchPrice')

const calls = []
const tx = {
  branchPrice: {
    create: async (input) => {
      calls.push(input)
      return input.data
    },
  },
}

const templateProduct = {
  id: 901,
  branchPrice: [{
    costPrice: 100,
    priceRetail: 150,
    priceWholesale: 140,
    priceTechnician: 145,
    priceOnline: 155,
    effectiveDate: null,
    expiredDate: null,
    isActive: true,
  }],
}

;(async () => {
  await cloneBranchPrice(tx, {
    templateProduct,
    newProductId: 902,
    targetBranchId: 2,
    updatedBy: 35,
    role: 'OWNER',
  })

  assert.strictEqual(calls.length, 1)
  assert.strictEqual(calls[0].data.branchId, 2)
  assert.strictEqual(calls[0].data.updatedBy, 35)
  assert.strictEqual(Number(calls[0].data.costPrice), 100)

  await assert.rejects(
    cloneBranchPrice(tx, {
      templateProduct: { id: 903, branchPrice: [] },
      newProductId: 904,
      targetBranchId: 2,
      updatedBy: 35,
      role: 'OWNER',
    }),
    (error) => error.code === 'TEMPLATE_BRANCH_PRICE_REQUIRED',
  )

  await assert.rejects(
    cloneBranchPrice(tx, {
      templateProduct: {
        id: 905,
        branchPrice: [{ ...templateProduct.branchPrice[0], costPrice: 0 }],
      },
      newProductId: 906,
      targetBranchId: 2,
      updatedBy: 35,
      role: 'OWNER',
    }),
    (error) => error.code === 'ZERO_PRICE_REQUIRES_EXPLICIT_POLICY',
  )

  await assert.rejects(
    cloneBranchPrice(tx, {
      templateProduct,
      newProductId: 907,
      targetBranchId: 2,
      updatedBy: 36,
      role: 'MANAGER',
    }),
    (error) => error.code === 'PRICE_MUTATION_FORBIDDEN',
  )

  console.log('template-clone-price-authority.contract.test.js: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
