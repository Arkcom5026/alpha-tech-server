'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(
  __dirname,
  '../src/modules/product/services/productTemplateEngine/productCloneService.js',
);
const source = fs.readFileSync(filePath, 'utf8');

assert.match(
  source,
  /require\('\.\.\/\.\.\/pricing\/policies\/priceAuthorityPolicy'\)/,
  'template engine clone service must depend on the central price authority policy',
);
assert.match(
  source,
  /priceAuthorityPolicy\.assertPricePayload\(/,
  'template engine clone must authorize source prices before product or price persistence',
);
assert.match(
  source,
  /TEMPLATE_BRANCH_PRICE_REQUIRED/,
  'template engine clone must reject missing template branch price explicitly',
);
assert.doesNotMatch(
  source,
  /costPrice:\s*sourcePrice\.costPrice\s*\?\?\s*0/,
  'template engine clone must not silently replace missing cost price with zero',
);
assert.match(
  source,
  /branchId:\s*authority\.branchId/,
  'persisted branch price must use the normalized authority branch',
);
assert.match(
  source,
  /updatedBy:\s*authority\.employeeId/,
  'persisted updater must use the normalized authority employee',
);
assert.match(
  source,
  /targetBranchId:\s*authority\.branchId/,
  'clone result must report the same authority-owned target branch',
);

console.log('product-template-engine-clone-price-authority.contract.test.js: PASS');
