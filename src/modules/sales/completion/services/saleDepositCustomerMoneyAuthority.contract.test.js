'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const posting = fs.readFileSync(path.join(__dirname, 'salePaymentPostingService.js'), 'utf8');
const cancellation = fs.readFileSync(path.join(
  __dirname,
  '../../payment/cancel/cancelPaymentController.js',
), 'utf8');

test('sale deposit payment joins the shared per-customer money lock before consuming source', () => {
  assert.match(posting, /acquireCustomerMoneyTransactionLock/);
  assert.match(posting, /DEPOSIT_CUSTOMER_REQUIRED/);
  assert.match(posting, /await acquireCustomerMoneyTransactionLock\(tx, customerId\)/);
  assert.match(posting, /customerId,\s*status: 'ACTIVE'/);
});

test('sale deposit payment honors source-specific legacy Customer Money reservations', () => {
  assert.match(posting, /getCustomerMoneySourceState/);
  assert.match(posting, /sourceType:\s*'CUSTOMER_DEPOSIT'/);
  assert.match(posting, /sourceState\.uncoveredLegacyReservation\.greaterThan\(0\)/);
  assert.match(posting, /requestedAmount\.greaterThan\(sourceState\.availableAmount\)/);
  assert.match(posting, /DEPOSIT_CUSTOMER_MONEY_RESERVED/);
});

test('sale deposit payment refreshes customer money balance after source mutation', () => {
  assert.match(posting, /calculateAvailableCustomerMoney/);
  assert.match(posting, /updateCustomerMoneyBalance/);
  assert.match(posting, /await refreshCustomerMoneyBalance\(tx, \{ branchId, customerId \}\)/);
});

test('payment cancellation restores deposit under the same customer lock and refreshes balance', () => {
  assert.match(cancellation, /hasDepositPayment/);
  assert.match(cancellation, /acquireCustomerMoneyTransactionLock/);
  assert.match(cancellation, /usedAmount: \{ decrement: usage\.amountUsed \}/);
  assert.match(cancellation, /status: 'ACTIVE'/);
  assert.match(cancellation, /calculateAvailableCustomerMoney/);
  assert.match(cancellation, /updateCustomerMoneyBalance/);
  assert.match(cancellation, /projectSalePaymentStatus\(tx, payment\.saleId\)/);
});