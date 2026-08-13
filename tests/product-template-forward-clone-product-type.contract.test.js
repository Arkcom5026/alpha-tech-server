'use strict'

const assert = require('assert')
const {
  adoptBranchProductType,
  assertProductTypeGlobalMappingIntegrity,
  normalizeProductTypeIdentity,
} = require('../src/modules/product/templateClone/services/productTemplateCloneService')

const globalType = { id: 1, name: 'คอมพิวเตอร์และโน้ตบุ๊ก', categoryId: 1 }

const typeRow = ({ id, name, branchId, normalizedName = null }) => ({
  id,
  name,
  normalizedName,
  active: true,
  branchId,
  globalProductTypeId: 1,
  globalProductType: globalType,
})

const run = async () => {
  assert.strictEqual(
    normalizeProductTypeIdentity('เมาส์ (Mouse)'),
    normalizeProductTypeIdentity('เมาส์ Mouse')
  )

  assert.doesNotThrow(() => assertProductTypeGlobalMappingIntegrity({
    templateType: typeRow({ id: 10, name: 'เมาส์ (Mouse)', branchId: 1 }),
    branchType: typeRow({ id: 20, name: 'เมาส์ (Mouse)', branchId: 5 }),
    globalProductTypeId: 1,
  }))

  const templateType = typeRow({
    id: 10,
    name: 'เมาส์ (Mouse)',
    normalizedName: 'เมาส์ mouse',
    branchId: 1,
  })
  const notebookType = typeRow({ id: 20, name: 'Notebook', branchId: 5 })
  const mouseType = typeRow({
    id: 21,
    name: 'เมาส์ Mouse',
    normalizedName: 'เมาส์ mouse',
    branchId: 5,
  })

  let createCalls = 0
  const reuseDb = {
    productType: {
      findFirst: async ({ where }) => {
        assert.strictEqual(where.id, 10)
        assert.strictEqual(where.branchId, 1)
        assert.strictEqual(where.globalProductTypeId, 1)
        return templateType
      },
      findMany: async ({ where }) => {
        assert.strictEqual(where.branchId, 5)
        assert.strictEqual(where.globalProductTypeId, 1)
        return [notebookType, mouseType]
      },
      create: async () => {
        createCalls += 1
        return null
      },
    },
  }

  const reused = await adoptBranchProductType({
    branchId: 5,
    templateBranchId: 1,
    templateProductTypeId: 10,
    globalProductTypeId: 1,
    db: reuseDb,
  })

  assert.strictEqual(reused.branchType.id, 21)
  assert.strictEqual(createCalls, 0)

  let createdPayload = null
  const createDb = {
    productType: {
      findFirst: async () => templateType,
      findMany: async () => [notebookType],
      create: async ({ data }) => {
        createdPayload = data
        return typeRow({
          id: 22,
          name: data.name,
          normalizedName: data.normalizedName,
          branchId: data.branchId,
        })
      },
    },
  }

  const created = await adoptBranchProductType({
    branchId: 5,
    templateBranchId: 1,
    templateProductTypeId: 10,
    globalProductTypeId: 1,
    db: createDb,
  })

  assert.strictEqual(created.branchType.id, 22)
  assert.strictEqual(createdPayload.name, 'เมาส์ (Mouse)')
  assert.strictEqual(createdPayload.branchId, 5)
  assert.strictEqual(createdPayload.globalProductTypeId, 1)
  assert.notStrictEqual(created.branchType.id, notebookType.id)

  console.log('PASS product-template-forward-clone-product-type.contract.test.js')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
