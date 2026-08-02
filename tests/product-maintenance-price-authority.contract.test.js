'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const servicePath = path.join(
  __dirname,
  '../src/modules/product/maintenance/services/productMaintenanceService.js',
)
const controllerPath = path.join(
  __dirname,
  '../src/modules/product/maintenance/controllers/productMaintenanceController.js',
)

const serviceSource = fs.readFileSync(servicePath, 'utf8')
const controllerSource = fs.readFileSync(controllerPath, 'utf8')

assert.match(
  serviceSource,
  /require\('\.\.\/\.\.\/pricing\/policies\/priceAuthorityPolicy'\)/,
  'product maintenance must depend on the central price authority policy',
)
assert.match(
  serviceSource,
  /priceAuthorityPolicy\.assertPricePayload\(/,
  'price mutations must be validated before persistence',
)
assert.match(
  serviceSource,
  /priceAuthorityPolicy\.assertActor\(actor\)/,
  'non-price product maintenance still requires authenticated branch ownership',
)
assert.doesNotMatch(
  serviceSource,
  /costPrice:\s*toNumberOrUndefined\([^\n]+\)\s*\?\?\s*0/,
  'maintenance must not silently create zero cost price',
)
assert.doesNotMatch(
  serviceSource,
  /priceRetail:\s*toNumberOrUndefined\([^\n]+\)\s*\?\?\s*0/,
  'maintenance must not silently create zero retail price',
)
assert.match(
  serviceSource,
  /branchId:\s*authority\.branchId/,
  'branch price persistence must use normalized authority branch',
)
assert.match(
  serviceSource,
  /updatedBy:\s*authority\.employeeId/,
  'price audit attribution must use normalized authority employee',
)
assert.match(
  controllerSource,
  /actor:\s*getActor\(req\)/,
  'controller must propagate authenticated actor as a single authority object',
)
assert.doesNotMatch(
  controllerSource,
  /branchId:\s*req\.body/,
  'request body must not control branch authority',
)
assert.match(
  controllerSource,
  /detail:\s*error\.detail/,
  'controller must preserve deterministic policy error details',
)

console.log('product-maintenance-price-authority.contract.test.js: PASS')
