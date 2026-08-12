'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { Prisma } = require('../../../../../lib/prisma');
const {
  createSettlementConsolidatedDelivery,
} = require('../../../finance/combined-billing/create/createSettlementConsolidatedDelivery');

const D = (value) => new Prisma.Decimal(String(value));
const prepared = [
  {
    requested: { saleId: 10, saleItemId: 1001, lineType: 'STOCK', amount: D(300) },
    sale: { id: 10, code: 'SL-10', customerId: 102, officialDocumentNumber: 'DN-10', customer: { id: 102 } },
    snapshot: { description: 'A', quantity: D(1), lineAmount: D(300) },
    alreadyAppliedAmount: D(0),
    completesLine: true,
  },
  {
    requested: { saleId: 11, saleItemId: 1002, lineType: 'STOCK', amount: D(500) },
    sale: { id: 11, code: 'SL-11', customerId: 127, officialDocumentNumber: 'DN-11', customer: { id: 127 } },
    snapshot: { description: 'B', quantity: D(1), lineAmount: D(500) },
    alreadyAppliedAmount: D(0),
    completesLine: true,
  },
];

const baseTx = (priorDocumentLines) => ({
  customerMoneySettlementGeneratedDocument: { findUnique: async () => null },
  consolidatedDeliveryLine: { findMany: async () => priorDocumentLines },
  combinedBillingDocument: { create: async () => { throw new Error('should not create'); } },
});

test('a cancelled historical consolidated line never crashes financial re-settlement with the immutable source-line key', async () => {
  const result = await createSettlementConsolidatedDelivery({
    tx: baseTx([{ sourceLineType: 'STOCK', sourceLineId: 1001, status: 'CANCELLED', combinedBillingId: 9 }]),
    branchId: 2,
    employeeId: 35,
    settlementId: 90,
    customerId: 35,
    prepared,
  });
  assert.equal(result, null);
});

test('an active documented source fails closed instead of duplicating a consolidated delivery', async () => {
  await assert.rejects(
    () => createSettlementConsolidatedDelivery({
      tx: baseTx([{ sourceLineType: 'STOCK', sourceLineId: 1001, status: 'DOCUMENTED', combinedBillingId: 9 }]),
      branchId: 2,
      employeeId: 35,
      settlementId: 91,
      customerId: 35,
      prepared,
    }),
    (error) => error?.code === 'SETTLEMENT_SOURCE_ALREADY_DOCUMENTED' && error?.statusCode === 409,
  );
});
