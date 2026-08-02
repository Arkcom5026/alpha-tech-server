'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const controllerPath = path.join(__dirname, '../src/modules/product/quickStock/controllers/quickStockController.js');
const servicePath = path.join(__dirname, '../src/modules/product/quickStock/services/QuickStockService.js');
const controller = fs.readFileSync(controllerPath, 'utf8');
const service = fs.readFileSync(servicePath, 'utf8');

assert.match(controller, /PRICE_ROLE_CONTEXT_REQUIRED/);
assert.match(controller, /quickStockInAllInOne\(data, actor\)/);
assert.match(controller, /quickReceiveExistingProduct\(data, actor\)/);
assert.doesNotMatch(controller, /quickStockInAllInOne\(\s*data,\s*actor\.branchId/);

assert.match(service, /priceAuthorityPolicy\.assertPricePayload/);
assert.match(service, /branchId:\s*authority\.branchId/);
assert.match(service, /updatedBy:\s*authority\.employeeId/);
assert.match(service, /scannedByEmployeeId:\s*authority\.employeeId/);
assert.doesNotMatch(service, /costPrice:\s*0,/);

console.log('quick stock price authority contract: PASS');
