'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const servicePath = path.join(
  process.cwd(),
  'src/modules/product/create/services/productCreateService.js',
)
const controllerPath = path.join(
  process.cwd(),
  'src/modules/product/create/controllers/productCreateController.js',
)

const serviceSource = fs.readFileSync(servicePath, 'utf8')
const controllerSource = fs.readFileSync(controllerPath, 'utf8')

assert.match(serviceSource, /priceAuthorityPolicy\.assertPricePayload\(/)
assert.match(serviceSource, /actor:\s*\{ branchId: brId, employeeId: empId, role, v2Role \}/)
assert.match(serviceSource, /costPrice === null \|\| costPrice <= 0/)
assert.match(serviceSource, /branchId: authority\.branchId/)
assert.match(serviceSource, /updatedBy: authority\.employeeId/)

assert.match(controllerSource, /const getRole = \(req\)/)
assert.match(controllerSource, /PRICE_ROLE_CONTEXT_REQUIRED/)
assert.match(controllerSource, /role: actor\.role/)
assert.doesNotMatch(
  controllerSource,
  /role:\s*req\.body/,
  'Product creation must not accept price authority from the request body.',
)

console.log('product-create-price-authority.contract.test.js: PASS')
