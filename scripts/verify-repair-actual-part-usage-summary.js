const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { Prisma } = require('@prisma/client');
const {
  calculateActualPartUsageSummary,
} = require('../src/modules/repair/services/repairPartUsageSummaryService');
const {
  RepairFailureCode,
} = require('../src/modules/repair/contracts/repairError');

function part(id, productId, name, qtyUsed, unitPrice) {
  return {
    id,
    productId,
    qtyUsed,
    unitPrice: new Prisma.Decimal(unitPrice),
    product: { name },
  };
}

function verifyCalculationContract() {
  const summary = calculateActualPartUsageSummary(
    100,
    [
      part(1, 10, 'RAM 8GB', 2, '1250.50'),
      part(2, 11, 'SSD 500GB', 1, '1999.99'),
    ],
    new Date('2026-07-26T00:00:00.000Z')
  );

  assert.deepEqual(summary, {
    repairJobId: 100,
    lines: [
      {
        partItemId: 1,
        productId: 10,
        productName: 'RAM 8GB',
        quantity: 2,
        unitPrice: '1250.50',
        lineAmount: '2501.00',
      },
      {
        partItemId: 2,
        productId: 11,
        productName: 'SSD 500GB',
        quantity: 1,
        unitPrice: '1999.99',
        lineAmount: '1999.99',
      },
    ],
    totals: {
      actualPartQuantity: 3,
      actualPartAmount: '4500.99',
    },
    calculatedAt: '2026-07-26T00:00:00.000Z',
  });
}

function verifyEmptySummary() {
  const summary = calculateActualPartUsageSummary(
    101,
    [],
    new Date('2026-07-26T00:00:00.000Z')
  );
  assert.equal(summary.totals.actualPartQuantity, 0);
  assert.equal(summary.totals.actualPartAmount, '0.00');
}

function verifyConsistencyGuards() {
  assert.throws(
    () => calculateActualPartUsageSummary(102, [part(3, 12, 'Bad Qty', -1, '10.00')]),
    (error) => error.code === RepairFailureCode.REPAIR_PART_USAGE_DATA_INCONSISTENT
  );

  assert.throws(
    () => calculateActualPartUsageSummary(103, [part(4, 13, 'Bad Price', 1, '-0.01')]),
    (error) => error.code === RepairFailureCode.REPAIR_PART_USAGE_DATA_INCONSISTENT
  );
}

function verifyRuntimeWiring() {
  const repositorySource = fs.readFileSync(
    path.join(__dirname, '../src/modules/repair/repositories/repairPartUsageRepository.js'),
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

  assert.match(repositorySource, /listPartUsage\(repairJobId\)/);
  assert.match(repositorySource, /repairPartItem\.findMany/);
  assert.match(controllerSource, /getPartUsageSummary/);
  assert.match(routesSource, /\/jobs\/:id\/parts\/summary/);
}

verifyCalculationContract();
verifyEmptySummary();
verifyConsistencyGuards();
verifyRuntimeWiring();

console.log('Repair Actual Part Usage Summary: PASS');
