'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = fs.readFileSync(path.join(__dirname, 'createDeliveryCreditSettlementService.js'), 'utf8');

test('settlement keeps customer-to-sale lock order and reconciles payment evidence before outstanding validation', () => {
  assert.match(service, /await acquireCustomerMoneySettlementLock\(tx, command\.branchId, command\.customerId\)/);
  assert.match(service, /await projectSalePaymentStatus\(tx, saleId\)/);
  assert.match(service, /const sale = await selectSale\(tx, saleId, command\.branchId, command\.customerId\)/);

  const customerLockIndex = service.indexOf('await acquireCustomerMoneySettlementLock(tx, command.branchId, command.customerId)');
  const saleProjectionIndex = service.indexOf('await projectSalePaymentStatus(tx, saleId)');
  const outstandingIndex = service.indexOf('const outstanding = money(sale.totalAmount).minus(money(sale.paidAmount))');
  assert.ok(customerLockIndex >= 0 && saleProjectionIndex > customerLockIndex, 'customer lock must precede sale lock');
  assert.ok(outstandingIndex > saleProjectionIndex, 'outstanding must be validated after unified payment projection');
});

test('settlement validates immutable branch/customer/credit identity before sale projection', () => {
  assert.match(service, /const selectSaleIdentity/);
  assert.match(service, /branchId,[\s\S]*customerId,[\s\S]*isCredit: true,[\s\S]*status: \{ not: 'CANCELLED' \}/);
  const identityIndex = service.indexOf('const identity = await selectSaleIdentity');
  const projectionIndex = service.indexOf('await projectSalePaymentStatus(tx, saleId)');
  assert.ok(identityIndex >= 0 && projectionIndex > identityIndex, 'sale identity must be tenant validated before projection write');
});
