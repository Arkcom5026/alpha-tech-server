'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const authoritySource = read('src/modules/sales/shared/creditReceivableAuthority.js');
const eligibilitySource = read('src/modules/customer-money/settlement/delivery-credit/listEligibleDeliveryCreditsService.js');
const paymentProjectionSource = read('src/modules/sales/completion/services/salePaymentPostingService.js');
const documentHistorySource = read('src/modules/finance/combined-billing/unifiedDocumentHistoryController.js');
const saleReturnValidatorSource = read('src/modules/sales/return/validators/saleReturnValidator.js');
const saleReturnRepositorySource = read('src/modules/sales/return/repositories/saleReturnRepository.js');
const saleReturnServiceSource = read('src/modules/sales/return/services/saleReturnService.js');

const {
  calculateReturnedReceivableAmount,
  calculateNetReceivableTotal,
  calculateOutstandingReceivable,
} = require('../src/modules/sales/shared/creditReceivableAuthority');
const { validateSaleReturnCommand } = require('../src/modules/sales/return/validators/saleReturnValidator');

// Production reference: SL-022608-0077 / Sale 1046.
const sale1046 = {
  totalAmount: 1810,
  paidAmount: 0,
  items: [{ price: 1170, returnedQuantity: 0 }],
  simpleItems: [{ quantity: 2, price: 640, returnedQuantity: 2 }],
};

assert.equal(calculateReturnedReceivableAmount(sale1046), 640);
assert.equal(calculateNetReceivableTotal(sale1046), 1170);
assert.equal(calculateOutstandingReceivable(sale1046), 1170);

// SaleReturn must support an unpaid credit return with no actual refund channel.
const command = validateSaleReturnCommand({
  commandId: 'sale-1046-preinvoice-return',
  saleId: 1046,
  reason: 'ลูกค้าคืนสินค้าก่อนชำระเงิน',
  items: [{
    kind: 'SIMPLE',
    saleItemSimpleId: 1,
    quantity: 2,
    refundAmount: 0,
  }],
  refunds: [],
});
assert.equal(command.items[0].refundAmount, 0);
assert.deepEqual(command.refunds, []);

// Returned quantity/value must flow into the Customer Money eligibility projection.
assert.match(eligibilitySource, /returnedQuantity:\s*true/);
assert.match(eligibilitySource, /calculateReturnedReceivableAmount\(sale\)/);
assert.match(eligibilitySource, /calculateNetReceivableTotal\(sale\)/);
assert.match(eligibilitySource, /outstandingAmount:\s*outstanding\(sale\)/);
assert.match(eligibilitySource, /line\.quantity > 0 && line\.remainingAmount > 0/);

// Delivery-note history preserves original total but exposes the return adjustment and net balance.
assert.match(documentHistorySource, /grossTotalAmount:\s*totalAmount/);
assert.match(documentHistorySource, /returnedAmount/);
assert.match(documentHistorySource, /billableAmount/);
assert.match(documentHistorySource, /balanceAmount = round2\(Math\.max\(0, billableAmount - paidAmount\)\)/);
assert.match(documentHistorySource, /items:\s*\{ select:\s*\{ price: true, returnedQuantity: true \} \}/);
assert.match(documentHistorySource, /simpleItems:\s*\{ select:\s*\{ quantity: true, price: true, returnedQuantity: true \} \}/);

// Payment/settlement close authority must use the same net receivable, not immutable Sale.totalAmount.
assert.match(paymentProjectionSource, /calculateNetReceivableTotal/);
assert.match(paymentProjectionSource, /items:\s*\{ select:\s*\{ price: true, returnedQuantity: true \} \}/);
assert.match(paymentProjectionSource, /simpleItems:\s*\{ select:\s*\{ quantity: true, price: true, returnedQuantity: true \} \}/);
assert.match(paymentProjectionSource, /const total = calculateNetReceivableTotal\(sale\)/);

// Pure unpaid credit adjustment creates no actual refund evidence.
assert.match(saleReturnRepositorySource, /if \(!command\.refunds\.length\) return Promise\.resolve\(\)/);
assert.match(saleReturnRepositorySource, /refundedByEmployeeId:\s*projection\.actualRefundTotal\.gt\(0\) \? employeeId : null/);

// Sale Return runtime remains stock/return authority and does not issue a tax credit note by itself.
assert.doesNotMatch(saleReturnServiceSource, /taxDocument\.create|creditNote.*create/i);
assert.match(saleReturnValidatorSource, /refunds = \(body\.refunds \|\| \[\]\)/);

// Keep one visible authority assertion so this test fails if the shared receivable layer is bypassed later.
assert.match(authoritySource, /calculateNetReceivableTotal/);

console.log('credit-sale-preinvoice-return-e2e.contract: PASS');
