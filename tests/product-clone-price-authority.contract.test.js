'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'src',
  'modules',
  'product',
  'services',
  'productCloneService.js',
);

const source = fs.readFileSync(filePath, 'utf8');

assert.match(
  source,
  /require\('\.\.\/pricing\/policies\/priceAuthorityPolicy'\)/,
  'product clone service must depend on the central price authority policy',
);
assert.match(
  source,
  /priceAuthorityPolicy\.assertPricePayload\(/,
  'product clone service must validate cloned prices before persistence',
);
assert.match(
  source,
  /TEMPLATE_BRANCH_PRICE_REQUIRED/,
  'product clone service must reject templates without a source branch price',
);
assert.doesNotMatch(
  source,
  /costPrice:\s*sourcePrice\.costPrice\s*\?\?\s*0/,
  'product clone service must not silently default missing cost to zero',
);
assert.match(
  source,
  /branchId:\s*authority\.branchId/,
  'persisted branch price must use normalized branch authority',
);
assert.match(
  source,
  /updatedBy:\s*authority\.employeeId/,
  'persisted audit actor must use normalized employee authority',
);
assert.match(
  source,
  /targetBranchId:\s*authority\.branchId/,
  'clone result must report the branch authorized for the operation',
);

console.log('product clone price authority contract: PASS');
