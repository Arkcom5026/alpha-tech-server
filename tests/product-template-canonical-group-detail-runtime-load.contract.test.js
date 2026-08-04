const assert = require('node:assert/strict')

assert.doesNotThrow(() => {
  require('../src/modules/productTemplate/candidates/query/groups/getCanonicalProductGroupService')
})

console.log('product-template-canonical-group-detail-runtime-load.contract.test.js: PASS')
