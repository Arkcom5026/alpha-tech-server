const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { Prisma } = require('@prisma/client');
const {
  REPAIR_PAYMENT_METHODS,
  validateRepairPayment,
  calculateSettlement,
} = require('../src/modules/repair/services/repairSettlementService');
const { RepairFailureCode } = require('../src/modules/repair/contracts/repairError');

function verifyPaymentContract() {
  const payment = validateRepairPayment({
    amount: '1250.50',
    method: 'qr',
    reference: ' TX-001 ',
    note: ' ชำระส่วนที่เหลือ ',
  });
  assert.equal(payment.amount.toFixed(2), '1250.50');
  assert.equal(payment.method, 'QR');
  assert.equal(payment.reference, 'TX-001');
  assert.equal(payment.note, 'ชำระส่วนที่เหลือ');

  assert.throws(
    () => validateRepairPayment({ amount: 0, method: 'CASH' }),
    (error) => error.code === RepairFailureCode.REPAIR_PAYMENT_AMOUNT_INVALID
  );
  assert.throws(
    () => validateRepairPayment({ amount: 100, method: 'CRYPTO' }),
    (error) => error.code === RepairFailureCode.REPAIR_PAYMENT_METHOD_INVALID
  );
  assert.ok(REPAIR_PAYMENT_METHODS.includes('TRANSFER'));
}

function verifySettlementMath() {
  const result = calculateSettlement({
    job: { depositPaid: new Prisma.Decimal('500.00') },
    approvedEstimate: { total: '2500.00', currency: 'THB' },
    payments: [{ amount: '1000.00' }, { amount: '1000.00' }],
  });
  assert.deepEqual(result, {
    currency: 'THB',
    approvedTotal: '2500.00',
    depositPaid: '500.00',
    paymentTotal: '2000.00',
    paidTotal: '2500.00',
    outstandingBalance: '0.00',
    overpaidAmount: '0.00',
    status: 'SETTLED',
  });

  const partial = calculateSettlement({
    job: { depositPaid: '200.00' },
    approvedEstimate: { total: '1000.00' },
    payments: [{ amount: '300.00' }],
  });
  assert.equal(partial.status, 'PARTIALLY_PAID');
  assert.equal(partial.outstandingBalance, '500.00');
}

function verifyRuntimeWiring() {
  const serviceSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/services/repairSettlementService.js'),
    'utf8'
  );
  const controllerSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/controllers/repairController.js'),
    'utf8'
  );
  const routesSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/routes/repairRoutes.js'),
    'utf8'
  );

  assert.match(serviceSource, /repairPayments/);
  assert.match(serviceSource, /latestApprovedEstimate/);
  assert.match(serviceSource, /REPAIR_PAYMENT_EXCEEDS_OUTSTANDING/);
  assert.match(controllerSource, /recordPayment/);
  assert.match(controllerSource, /getSettlement/);
  assert.match(routesSource, /\/jobs\/:id\/payments/);
  assert.match(routesSource, /\/jobs\/:id\/settlement/);
}

function verifyFailureContracts() {
  assert.equal(
    RepairFailureCode.REPAIR_PAYMENT_EXCEEDS_OUTSTANDING,
    'REPAIR_PAYMENT_EXCEEDS_OUTSTANDING'
  );
  assert.equal(
    RepairFailureCode.REPAIR_SETTLEMENT_REQUIRED,
    'REPAIR_SETTLEMENT_REQUIRED'
  );
}

verifyPaymentContract();
verifySettlementMath();
verifyRuntimeWiring();
verifyFailureContracts();

console.log('Repair Settlement Foundation: PASS');
