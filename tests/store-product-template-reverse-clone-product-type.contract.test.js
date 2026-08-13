'use strict'

const assert = require('node:assert/strict')
const {
  ensureTemplateProductType,
} = require('../src/modules/product/templateReverseClone/services/storeProductTemplateReverseCloneService')

const sourceProduct = {
  productType: {
    id: 311,
    name: 'เมาส์ (Mouse)',
    normalizedName: 'เมาส์ (mouse)',
    active: true,
    branchId: 2,
    globalProductTypeId: 1,
    globalProductType: {
      id: 1,
      name: 'คอมพิวเตอร์และโน้ตบุ๊ก',
      categoryId: 1,
    },
  },
}

const makeCandidate = (overrides = {}) => ({
  id: 10,
  name: 'คอมพิวเตอร์ / โน้ตบุ๊ก',
  normalizedName: 'คอมพิวเตอร์ / โน้ตบุ๊ก',
  active: true,
  branchId: 1,
  globalProductTypeId: 1,
  globalProductType: {
    id: 1,
    name: 'คอมพิวเตอร์และโน้ตบุ๊ก',
    categoryId: 1,
  },
  ...overrides,
})

const run = async () => {
  let createdData = null
  const broadFamilyDb = {
    productType: {
      findMany: async () => [makeCandidate()],
      create: async ({ data }) => {
        createdData = data
        return makeCandidate({
          id: 99,
          name: data.name,
          normalizedName: data.normalizedName,
          active: data.active,
          branchId: data.branchId,
          globalProductTypeId: data.globalProductTypeId,
        })
      },
      findFirst: async () => null,
    },
  }

  const created = await ensureTemplateProductType({
    sourceProduct,
    templateBranchId: 1,
    db: broadFamilyDb,
  })

  assert.equal(created.id, 99)
  assert.equal(created.name, 'เมาส์ (Mouse)')
  assert.deepEqual(createdData, {
    name: 'เมาส์ (Mouse)',
    active: true,
    normalizedName: 'เมาส์ (mouse)',
    branchId: 1,
    globalProductTypeId: 1,
  })

  let createCalled = false
  const exactDb = {
    productType: {
      findMany: async () => [
        makeCandidate(),
        makeCandidate({
          id: 100,
          name: 'เมาส์ (Mouse)',
          normalizedName: 'เมาส์ (mouse)',
        }),
      ],
      create: async () => {
        createCalled = true
        throw new Error('must not create when exact ProductType exists')
      },
      findFirst: async () => null,
    },
  }

  const existing = await ensureTemplateProductType({
    sourceProduct,
    templateBranchId: 1,
    db: exactDb,
  })

  assert.equal(existing.id, 100)
  assert.equal(createCalled, false)

  console.log('Store Product Template Reverse Clone ProductType Contract: PASS')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
