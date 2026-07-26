const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
  assertFinanciallyReadyForHandover,
} = require('../src/modules/repair/services/repairHandoverService');
const { RepairFailureCode } = require('../src/modules/repair/contracts/repairError');

function approvedEstimate(total = '1000.00') {
  return {
    id: 'estimate-approved',
    repairJobId: 10,
    status: 'APPROVED',
    total,
    currency: 'THB',
    createdAt: '2026-07-26T00:00:00.000Z',
    decidedAt: '2026-07-26T01:00:00.000Z',
  };
}

function verifySettledHandover() {
  const settlement = assertFinanciallyReadyForHandover(
    { id: 10, depositPaid: '200.00' },
    {
      repairEstimates: [approvedEstimate()],
      repairPayments: [
        {
          id: 'payment-1',
          repairJobId: 10,
          amount: '800.00',
          status: 'RECORDED',
        },
      ],
    }
  );
  assert.equal(settlement.status, 'SETTLED');
  assert.equal(settlement.outstandingBalance, '0.00');
}

function verifyOutstandingBlocked() {
  assert.throws(
    () =>
      assertFinanciallyReadyForHandover(
        { id: 10, depositPaid: '100.00' },
        {
          repairEstimates: [approvedEstimate()],
          repairPayments: [{ repairJobId: 10, amount: '300.00', status: 'RECORDED' }],
        }
      ),
    (error) =>
      error.code === RepairFailureCode.REPAIR_SETTLEMENT_REQUIRED &&
      error.details.outstandingBalance === '600.00'
  );
}

function verifyNoChargeFlowAllowed() {
  assert.equal(
    assertFinanciallyReadyForHandover(
      { id: 10, depositPaid: '0.00' },
      { repairEstimates: [], repairPayments: [] }
    ),
    null
  );
}

function verifyRuntimeWiring() {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/services/repairHandoverService.js'),
    'utf8'
  );
  assert.match(source, /assertFinanciallyReadyForHandover/);
  assert.match(source, /REPAIR_SETTLEMENT_REQUIRED/);
  assert.match(source, /lastCustomerHandover/);
  assert.match(source, /settlement/);
}

verifySettledHandover();
verifyOutstandingBlocked();
verifyNoChargeFlowAllowed();
verifyRuntimeWiring();

console.log('Repair Handover Settlement Guard: PASS');
