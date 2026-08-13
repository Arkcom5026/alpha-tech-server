const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  normalizeProductTypeIdentity,
  TemplateProductSearchService,
} = require('../src/modules/product/templateSearch/services/templateProductSearchService')

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8')

const controllerSource = read('src/modules/product/templateSearch/controllers/templateProductSearchController.js')
const serviceSource = read('src/modules/product/templateSearch/services/templateProductSearchService.js')

assert.match(controllerSource, /sourceBranchId:\s*req\.user\?\.branchId/)
assert.match(serviceSource, /resolveTemplateProductTypeId/)
assert.match(serviceSource, /globalProductTypeId/)
assert.match(serviceSource, /normalizedName/)
assert.match(serviceSource, /productType\.findMany/)
assert.match(serviceSource, /normalizeProductTypeIdentity/)
assert.match(serviceSource, /templateProductTypeId:\s*templateType\?\.id \|\| null/)
assert.match(serviceSource, /if \(typeResolution\.requested && !typeResolution\.templateProductTypeId\) \{\s*return \[\]/)
assert.match(serviceSource, /productTypeId:\s*typeResolution\.templateProductTypeId/)
assert.match(serviceSource, /globalProductTypeId:\s*product\.productType\?\.globalProductTypeId/)

assert.strictEqual(
  normalizeProductTypeIdentity('เมาส์ (Mouse)'),
  normalizeProductTypeIdentity('เมาส์ Mouse')
)

const makePrisma = (templateTypes) => ({
  productType: {
    findFirst: async ({ where }) => {
      assert.strictEqual(where.id, 501)
      assert.strictEqual(where.branchId, 5)
      return {
        id: 501,
        name: 'เมาส์ (Mouse)',
        normalizedName: 'เมาส์ mouse',
        globalProductTypeId: 1,
      }
    },
    findMany: async ({ where }) => {
      assert.strictEqual(where.branchId, 1)
      assert.strictEqual(where.globalProductTypeId, 1)
      return templateTypes
    },
  },
})

const run = async () => {
  const service = new TemplateProductSearchService(makePrisma([
    { id: 10, name: 'Notebook', normalizedName: 'notebook' },
    { id: 11, name: 'เมาส์ Mouse', normalizedName: 'เมาส์ mouse' },
    { id: 12, name: 'สายสัญญาณ', normalizedName: 'สายสัญญาณ' },
  ]))

  const resolved = await service.resolveTemplateProductTypeId({
    productTypeId: 501,
    sourceBranchId: 5,
    templateBranchId: 1,
  })

  assert.deepStrictEqual(resolved, {
    requested: true,
    templateProductTypeId: 11,
  })

  const noExactService = new TemplateProductSearchService(makePrisma([
    { id: 10, name: 'Notebook', normalizedName: 'notebook' },
  ]))
  const missing = await noExactService.resolveTemplateProductTypeId({
    productTypeId: 501,
    sourceBranchId: 5,
    templateBranchId: 1,
  })

  assert.deepStrictEqual(missing, {
    requested: true,
    templateProductTypeId: null,
  })

  console.log('Product Template Search Type Alignment Contract: PASS')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
