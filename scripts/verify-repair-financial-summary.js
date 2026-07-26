const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { Prisma } = require('@prisma/client');
const {
  calculateRepairFinancialSummary,
  latestApprovedEstimate,
} = require('../src/modules/repair/services/repairFinancialSummaryService');
const {
  RepairFailureCode,
} = require('../src/modules/repair/contracts/repairError');

function estimate(overrides = {}) {
  return {
    id: 'estimate-approved',
    repairJobId: 44,
    status: 'APPROVED',
    currency: 'THB',
    subtotal: 1750,
    total: 1750,
    createdAt: '2026-07-26T08:00:00.000Z',
    decidedAt: '2026-07-26T09:00:00.000Z',
    items: [
      { type: 'LABOR', amount: 500 },
      { type: 'PART', amount: 1000 },
      { type: 'SERVICE', amount: 200 },
      { type: 'OTHER', amount: 50 },
    ],
    ...overrides,
  };
}

function part(id, qtyUsed, unitPrice) {
  return {
    id,
    productId: 100 + id,
    qtyUsed,
    unitPrice: new Prisma.Decimal(unitPrice),
    product: { name: `Part ${id}` },
  };
}

function verifyApprovedEstimateSelection() {
  const selected = latestApprovedEstimate(44, [
    estimate({ id: 'older', decidedAt: '2026-07-25T09:00:00.000Z' }),
    estimate({ id: 'rejected', status: 'REJECTED', decidedAt: '2026-07-27T09:00:00.000Z' }),
    estimate({ id: 'latest', decidedAt: '2026-07-26T10:00:00.000Z' }),
    estimate({ id: 'other-job', repairJobId: 45, decidedAt: '2026-07-28T09:00:00.000Z' }),
  ]);
  assert.equal(selected.id, 'latest');
}

function verifySummaryCalculation() {
  const calculatedAt = new Date('2026-07-26T10:00:00.000Z');
  const result = calculateRepairFinancialSummary({
    job: {
      id: 44,
      jobNo: 'R-0044',
      depositPaid: new Prisma.Decimal('300.00'),
    },
    estimates: [estimate()],
    parts: [part(1, 2, '250.25'), part(2, 1, '600.00')],
    calculatedAt,
  });

  assert.equal(result.currency, 'THB');
  assert.equal(result.approvedEstimate.breakdown.labor, '500.00');
  assert.equal(result.approvedEstimate.breakdown.part, '1000.00');
  assert.equal(result.actualPartUsage.totals.actualPartQuantity, 3);
  assert.equal(result.actualPartUsage.totals.actualPartAmount, '1100.50');
  assert.equal(result.comparison.partVariance, '100.50');
  assert.equal(result.settlement.approvedTotal, '1750.00');
  assert.equal(result.settlement.depositPaid, '300.00');
  assert.equal(result.settlement.outstandingBalance, '1450.00');
  assert.equal(result.settlement.overpaidAmount, '0.00');
  assert.equal(result.readiness.financiallyReadyForBilling, true);
  assert.equal(result.calculatedAt, calculatedAt.toISOString());
}

function verifyNoApprovedEstimate() {
  const result = calculateRepairFinancialSummary({
    job: { id: 44, jobNo: 'R-0044', depositPaid: 100 },
    estimates: [estimate({ status: 'REJECTED' })],
    parts: [],
  });

  assert.equal(result.approvedEstimate, null);
  assert.equal(result.settlement.approvedTotal, '0.00');
  assert.equal(result.settlement.outstandingBalance, '0.00');
  assert.equal(result.settlement.overpaidAmount, '100.00');
  assert.equal(result.readiness.financiallyReadyForBilling, false);
}

function verifyInvalidFinancialData() {
  assert.throws(
    () => calculateRepairFinancialSummary({
      job: { id: 44, depositPaid: -1 },
      estimates: [],
      parts: [],
    }),
    (error) => error.code === RepairFailureCode.REPAIR_FINANCIAL_DATA_INCONSISTENT
  );

  assert.throws(
    () => calculateRepairFinancialSummary({
      job: { id: 44, depositPaid: 0 },
      estimates: [estimate({ items: [{ type: 'LABOR', amount: -1 }] })],
      parts: [],
    }),
    (error) => error.code === RepairFailureCode.REPAIR_FINANCIAL_DATA_INCONSISTENT
  );
}

function verifyRuntimeWiring() {
  const serviceSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/services/repairFinancialSummaryService.js'),
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

  assert.match(serviceSource, /calculateActualPartUsageSummary/);
  assert.match(serviceSource, /estimateHistory/);
  assert.match(serviceSource, /financiallyReadyForBilling/);
  assert.match(controllerSource, /getFinancialSummary/);
  assert.match(routesSource, /\/jobs\/:id\/financial-summary/);
}

verifyApprovedEstimateSelection();
verifySummaryCalculation();
verifyNoApprovedEstimate();
verifyInvalidFinancialData();
verifyRuntimeWiring();

console.log('Repair Financial Summary: PASS');
