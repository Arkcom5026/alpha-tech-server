'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const createPaymentController = fs.readFileSync(path.join(__dirname, 'createPaymentController.js'), 'utf8');
const markPaidController = fs.readFileSync(path.join(
  __dirname,
  '../../settlement/controllers/saleSettlementController.js',
), 'utf8');

test('normal payment creation projects and locks sale payment state before consuming outstanding', () => {
  assert.match(createPaymentController, /requestedTotal/);
  assert.match(createPaymentController, /currentPaymentState = await projectSalePaymentStatus\(tx, sale\.id\)/);
  assert.match(createPaymentController, /outstandingAmount = D\(currentPaymentState\.totalAmount\)[\s\S]*minus\(D\(currentPaymentState\.paidAmount\)\)/);
  assert.match(createPaymentController, /requestedTotal\.greaterThan\(outstandingAmount\.plus\(D\('0\.001'\)\)\)/);
  assert.match(createPaymentController, /PAYMENT_EXCEEDS_OUTSTANDING/);

  const projectionIndex = createPaymentController.indexOf('currentPaymentState = await projectSalePaymentStatus');
  const createIndex = createPaymentController.indexOf('const payment = await tx.payment.create');
  assert.ok(projectionIndex >= 0 && createIndex > projectionIndex, 'payment projection/lock must occur before payment write');
});

test('deposit payment keeps customer-to-sale lock order used by customer money settlement', () => {
  assert.match(createPaymentController, /usesCustomerDeposit/);
  assert.match(createPaymentController, /await acquireCustomerMoneyTransactionLock\(tx, sale\.customerId\)/);
  const customerLockIndex = createPaymentController.indexOf('await acquireCustomerMoneyTransactionLock(tx, sale.customerId)');
  const saleLockIndex = createPaymentController.indexOf('currentPaymentState = await projectSalePaymentStatus');
  assert.ok(customerLockIndex >= 0 && saleLockIndex > customerLockIndex, 'customer lock must precede sale projection lock');
});

test('legacy mark-paid uses unified payment projection instead of native PaymentItem-only evidence', () => {
  assert.match(markPaidController, /projectSalePaymentStatus\(tx, saleId\)/);
  assert.match(markPaidController, /projectedPaidAmount/);
  assert.match(markPaidController, /projection\.paid/);
  assert.doesNotMatch(markPaidController, /paymentItem\.aggregate/);
});
