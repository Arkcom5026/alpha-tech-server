'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(
    __dirname,
    '../src/modules/product/services/productTemplateEngine/QuickStockService.js',
  ),
  'utf8',
);

assert.match(source, /employeeId\s*=\s*null/);
assert.match(source, /role,/);
assert.match(source, /v2Role,/);
assert.match(source, /const actorEmployeeId = toPositiveInt\(employeeId \?\? updatedBy\)/);
assert.match(source, /employeeId:\s*actorEmployeeId/);
assert.match(source, /await cloneBranchPrice\(tx,\s*\{[\s\S]*role,[\s\S]*v2Role/);
assert.doesNotMatch(source, /cloneBranchPrice\(tx,[\s\S]*updatedBy,\s*\}/);

console.log('product-template-engine quick-stock price authority contract: PASS');
