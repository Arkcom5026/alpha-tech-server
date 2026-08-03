'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const repository = read('src/modules/product/trace/repositories/productTraceRepository.js');
const service = read('src/modules/product/trace/services/productTraceService.js');
const returnBuilder = read('src/modules/product/trace/builders/productTraceReturnBuilder.js');

assert.match(repository, /client\.stockItem\.findFirst/);
assert.match(repository, /where: \{ branchId: Number\(branchId\)/);
assert.match(repository, /saleItems: \{ include: saleItemInclude/);
assert.match(repository, /returnItems/);
assert.match(repository, /refundTransaction/);
assert.doesNotMatch(repository, /saleItemsSimple/);

assert.match(service, /buildProductTraceReturns\(stockItem, permissions\)/);
assert.match(service, /buildProductTraceTimeline\(\{/);
assert.doesNotMatch(service, /saleItemsSimple/);

assert.match(returnBuilder, /saleReturn\.stockRestoredAt/);
assert.match(returnBuilder, /refundTransactions/);

console.log('Product Trace StockItem sale-return history contract: PASS');
