'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const repository = read('src/modules/sales/item-search/repositories/saleItemSearchRepository.js');
const service = read('src/modules/sales/item-search/services/saleItemSearchService.js');

for (const token of [
  'findProductAvailability',
  'GREATEST("quantity" - "reserved", 0)',
  '"branchId" = ${branchId}',
  '"productId" IN (${Prisma.join(normalizedIds)})',
]) {
  assert(repository.includes(token), `Missing reserved-stock repository authority: ${token}`);
}

for (const token of [
  'reservationAwareCandidates',
  'availableToSell',
  "'SALE_ITEM_RESERVED'",
  'สินค้านี้ถูกกันไว้สำหรับใบจอง',
  'physicalQtyRemaining',
]) {
  assert(service.includes(token), `Missing POS reserved-stock enforcement: ${token}`);
}

assert(!service.includes('quantityAvailable: toNumber(simpleLot.qtyRemaining)'), 'Simple lot must not expose physical quantity as sellable quantity');

console.log('POS reserved stock search enforcement contract: PASS');
