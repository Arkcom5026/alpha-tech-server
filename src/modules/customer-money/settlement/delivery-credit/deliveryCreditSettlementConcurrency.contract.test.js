'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const service = fs.readFileSync(path.join(__dirname, 'createDeliveryCreditSettlementService.js'), 'utf8');

test('settlement keeps owner-to-sale lock order and reconciles payment evidence before outstanding validation', () => {
  assert.match(service, /await acquireCustomerMoneySettlementLock\(tx, command\.branchId, command\.customerId, group\.ownerId\)/);
  assert.match(service, /await projectSalePaymentStatus\(tx, saleId\)/);
  assert.match(service, /const sale = await selectSale\(tx, saleId, command\.branchId, group\.memberIds\)/);

  const customerLockIndex = service.indexOf('await acquireCustomerMoneySettlementLock(tx, command.branchId, command.customerId, group.ownerId)');
  const saleProjectionIndex = service.indexOf('await projectSalePaymentStatus(tx, saleId)');
  const outstandingIndex = service.indexOf('const outstanding = money(sale.totalAmount).minus(money(sale.paidAmount))');
  assert.ok(customerLockIndex >= 0 && saleProjectionIndex > customerLockIndex, 'financial owner lock must precede sale lock');
  assert.ok(outstandingIndex > saleProjectionIndex, 'outstanding must be validated after unified payment projection');
});

test('settlement validates immutable branch/customer/credit identity before sale projection', () => {
  assert.match(service, /const selectSaleIdentity/);
  assert.match(service, /branchId,[\s\S]*customerId: \{ in: customerIds \},[\s\S]*isCredit: true,[\s\S]*status: \{ not: 'CANCELLED' \}/);
  const identityIndex = service.indexOf('const identity = await selectSaleIdentity');
  const projectionIndex = service.indexOf('await projectSalePaymentStatus(tx, saleId)');
  assert.ok(identityIndex >= 0 && projectionIndex > identityIndex, 'sale identity must be tenant validated before projection write');
});

test('settlement extends the interactive transaction lifetime and reuses the resolved financial group', () => {
  assert.match(service, /SETTLEMENT_TRANSACTION_OPTIONS = Object\.freeze\(\{ maxWait: 10000, timeout: 30000 \}\)/);
  assert.match(service, /\}, SETTLEMENT_TRANSACTION_OPTIONS\);/);
  assert.match(service, /calculateAvailableCustomerMoney\(tx, \{[\s\S]*financialGroup: group/);
  assert.match(service, /consumeCustomerMoneySources\(tx, \{[\s\S]*financialGroup: group/);
  assert.match(service, /loadSettlementCreateResult\(tx, settlement\.id, \{[\s\S]*financialGroup: group/);
});
