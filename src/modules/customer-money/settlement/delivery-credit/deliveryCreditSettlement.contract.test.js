'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const contract = read('deliveryCreditSettlementContract.js');
const queryService = read('listEligibleDeliveryCreditsService.js');
const route = read('deliveryCreditSettlementRoute.js');

test('eligible delivery credit query is branch and customer scoped', () => {
  assert.match(queryService, /branchId:\s*command\.branchId/);
  assert.match(queryService, /customerId:\s*command\.customerId/);
  assert.match(queryService, /isCredit:\s*true/);
  assert.match(queryService, /status:\s*'COMPLETED'/);
  assert.match(queryService, /statusPayment:\s*\{\s*in:\s*\['UNPAID', 'PARTIALLY_PAID'\]/);
});

test('eligible delivery credit query is read-only and exposes item references', () => {
  assert.match(queryService, /prisma\.sale\.findMany/);
  assert.match(queryService, /prisma\.customerMoneyBalance\.findUnique/);
  assert.doesNotMatch(queryService, /\.create\(|\.update\(|\.delete\(/);
  assert.match(queryService, /lineType:\s*'STOCK'/);
  assert.match(queryService, /lineType:\s*'SIMPLE'/);
  assert.match(queryService, /outstandingAmount/);
});

test('settlement command supports multi-sale item-level partial application', () => {
  assert.match(contract, /lines\.map/);
  assert.match(contract, /saleId/);
  assert.match(contract, /saleItemId/);
  assert.match(contract, /lineType/);
  assert.match(contract, /amount/);
});

test('settlement endpoint is isolated from legacy customer receipt allocation', () => {
  assert.match(route, /eligible-sales/);
  assert.doesNotMatch(route, /customer-receipt|allocation/i);
});
