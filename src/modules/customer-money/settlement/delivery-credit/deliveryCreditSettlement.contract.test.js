'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');
const contract = read('deliveryCreditSettlementContract.js');
const queryService = read('listEligibleDeliveryCreditsService.js');
const createService = read('createDeliveryCreditSettlementService.js');
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

test('settlement write is atomic across customer money and sale payment projection', () => {
  assert.match(createService, /prisma\.\$transaction/);
  assert.match(createService, /customerMoneySettlement\.create/);
  assert.match(createService, /createCustomerMoneyApplication/);
  assert.match(createService, /eventType:\s*'MONEY_APPLIED'/);
  assert.match(createService, /direction:\s*'DEBIT'/);
  assert.match(createService, /updateCustomerMoneyBalance/);
  assert.match(createService, /tx\.sale\.update/);
  assert.match(createService, /paidAmount:\s*nextPaid/);
  assert.match(createService, /statusPayment:\s*derivePaymentStatus/);
});

test('settlement write preserves stock and legacy receipt boundaries', () => {
  assert.doesNotMatch(createService, /stockItem\.update|stockMovement|inventory|customerReceiptAllocation\.create/);
  assert.match(createService, /targetType:\s*'DELIVERY_CREDIT'/);
  assert.match(createService, /sourceType:\s*'CUSTOMER_MONEY_BALANCE'/);
  assert.match(route, /router\.post\('\/'/);
  assert.doesNotMatch(route, /customer-receipt|allocation/i);
});
