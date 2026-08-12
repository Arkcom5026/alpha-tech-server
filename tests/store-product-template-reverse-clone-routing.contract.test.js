'use strict'

const assert = require('node:assert/strict')
const {
  resolveMatchingTemplateBranch,
} = require('../src/modules/product/templateReverseClone/services/storeProductTemplateReverseCloneService')

const sourceBranch = {
  id: 13,
  name: 'Runtime Store',
  branchCode: null,
  businessType: 'GENERAL',
  categoryId: 18,
}

const templateBranch = {
  id: 1,
  name: 'IT & Mobile Product Template',
  branchCode: 'T01',
  businessType: 'GENERAL',
  categoryId: 1,
}

const sourceProduct = {
  id: 3808,
  productType: {
    globalProductTypeId: 1,
    globalProductType: {
      id: 1,
      name: 'คอมพิวเตอร์และโน้ตบุ๊ก',
      categoryId: 1,
    },
  },
}

const calls = []
const db = {
  branch: {
    findUnique: async ({ where }) => {
      assert.equal(where.id, sourceBranch.id)
      return sourceBranch
    },
    findFirst: async (args) => {
      calls.push(args)
      const where = args?.where || {}
      if (where.branchCode === 'T01' && where.categoryId === 1) return templateBranch
      return null
    },
  },
}

;(async () => {
  const result = await resolveMatchingTemplateBranch({
    sourceBranchId: sourceBranch.id,
    sourceProduct,
    db,
  })

  assert.equal(result.supported, true)
  assert.equal(result.sourceBranch.id, 13)
  assert.equal(result.sourceBranch.categoryId, 18)
  assert.equal(result.productCategoryId, 1)
  assert.equal(result.templateBranch.id, 1)
  assert.equal(result.templateBranch.branchCode, 'T01')
  assert.equal(result.templateBranch.categoryId, 1)

  assert.ok(
    calls.some((call) => call?.where?.branchCode === 'T01' && call?.where?.categoryId === 1),
    'GENERAL source store must resolve T01 by Product GlobalProductType.categoryId',
  )

  console.log('Store Product Template Reverse Clone Routing Contract: PASS')
})().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
