const assert = require('node:assert/strict')

const { QuickReceiveDropdownService } = require('./quickReceiveDropdownService')

const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const templateRead = deferred()
const unitRead = deferred()
const brandRead = deferred()
const calls = []

const repository = {
  listTemplateProductTypes(params) {
    calls.push(['productTypes', params])
    return templateRead.promise
  },
  listUnits() {
    calls.push(['units'])
    return unitRead.promise
  },
  listBrandsForProductType(params) {
    calls.push(['brands', params])
    return brandRead.promise
  },
}

const service = new QuickReceiveDropdownService(null, repository)
const resultPromise = service.getDropdowns({ productTypeId: '17', includeInactive: false })

// All independent reads must be started before any one of them settles. This
// locks the initial-load latency contract against accidental serial awaits.
assert.deepEqual(calls, [
  ['productTypes', { includeInactive: false }],
  ['units'],
  ['brands', { productTypeId: 17, includeInactive: false }],
])

templateRead.resolve({
  templateBranch: { id: 1, branchCode: 'T01' },
  productTypes: [
    {
      id: 17,
      name: 'Printer',
      active: true,
      branchId: 1,
      globalProductTypeId: 5,
      globalProductType: { id: 5, name: 'Printer', categoryId: 9 },
    },
  ],
})
unitRead.resolve([{ id: 2, name: 'ชิ้น' }])
brandRead.resolve([{ id: 3, name: 'HP', normalizedName: 'hp', active: true }])

resultPromise
  .then((result) => {
    assert.equal(result.success, true)
    assert.equal(result.templateBranchCode, 'T01')
    assert.equal(result.productTypes.length, 1)
    assert.equal(result.productTypes[0].categoryId, 9)
    assert.deepEqual(result.units, [{ id: 2, name: 'ชิ้น' }])
    assert.deepEqual(result.brands, [
      { id: 3, name: 'HP', normalizedName: 'hp', active: true },
    ])
    console.log('✅ QuickReceiveDropdownService initial-load parallel read contract passed')
  })
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
