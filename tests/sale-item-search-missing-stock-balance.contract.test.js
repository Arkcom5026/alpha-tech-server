'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.resolve(__dirname, '..');
const repository = fs.readFileSync(
  path.join(root, 'src/modules/sales/item-search/repositories/saleItemSearchRepository.js'),
  'utf8',
);

for (const token of [
  'WITH requested_products AS',
  'physical_inventory AS',
  'LEFT JOIN "StockBalance" balance',
  'LEFT JOIN physical_inventory physical',
  'COALESCE(balance."quantity", physical.quantity, 0)',
  'COALESCE(balance."reserved", 0)',
  '(balance."productId" IS NULL) AS "balanceMissing"',
  '"branchId" = ${branchId}',
  "status = 'IN_STOCK'",
  "status = 'ACTIVE'",
]) {
  assert(repository.includes(token), `Missing stock-balance recovery contract: ${token}`);
}

assert(
  !repository.includes('FROM "StockBalance"\n    WHERE'),
  'Availability lookup must not drop requested products when StockBalance is missing',
);

console.log('Sale item search missing StockBalance recovery contract: PASS');
