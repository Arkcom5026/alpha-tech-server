'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Prisma } = require('../../../../../lib/prisma');
const {
  createSettlementConsolidatedDelivery,
  isAutoConsolidationBatch,
  loadSettlementGeneratedDocument,
} = require('../../../finance/combined-billing/create/createSettlementConsolidatedDelivery');

const read = (relative) => fs.readFileSync(path.join(__dirname, relative), 'utf8');
const createSettlement = read('createDeliveryCreditSettlementService.js');
const cancelSettlement = read('cancelDeliveryCreditSettlementService.js');
const querySettlement = read('queryDeliveryCreditSettlementService.js');
const generator = read('../../../finance/combined-billing/create/createSettlementConsolidatedDelivery.js');

const D = (value) => new Prisma.Decimal(String(value));

const preparedLine = ({ saleId, customerId, lineId, lineAmount, applied, previously = 0, completesLine = true }) => ({
  requested: { saleId, saleItemId: lineId, lineType: 'STOCK', amount: D(applied) },
  sale: {
    id: saleId,
    code: `SL-${saleId}`,
    customerId,
    officialDocumentNumber: `DN-${saleId}`,
    customer: { id: customerId, companyName: 'หน่วยงานเดียวกัน', departmentName: `ฝ่าย ${customerId}` },
  },
  snapshot: { description: `สินค้า ${lineId}`, quantity: D(1), unitAmount: D(lineAmount), lineAmount: D(lineAmount) },
  alreadyAppliedAmount: D(previously),
  completesLine,
});

test('settlement completion is the automatic consolidated-delivery boundary and remains stock-free', () => {
  assert.match(createSettlement, /createSettlementConsolidatedDelivery/);
  assert.match(createSettlement, /completesLine:/);
  assert.match(createSettlement, /customerId:\s*group\.ownerId/);
  assert.doesNotMatch(generator, /stockMovement|stockItem\.update|inventory/i);
  assert.match(generator, /sourceCustomerId/);
  assert.match(generator, /completedBySettlementId/);
  assert.match(generator, /pg_advisory_xact_lock/);
});

test('generated document authority reuses immutable ConsolidatedDeliveryLine sourceSnapshot without a new schema', () => {
  assert.match(generator, /sourceSnapshot:[\s\S]*completedBySettlementId/);
  assert.match(generator, /path:\s*\['completedBySettlementId'\]/);
  assert.match(generator, /findSettlementGeneratedDocumentAnchor/);
  assert.doesNotMatch(generator, /customerMoneySettlementGeneratedDocument/);
});

test('automatic consolidation requires a complete batch spanning at least two source deliveries', () => {
  const oneSale = [
    preparedLine({ saleId: 10, customerId: 102, lineId: 1001, lineAmount: 300, applied: 300 }),
  ];
  const partialBatch = [
    preparedLine({ saleId: 10, customerId: 102, lineId: 1001, lineAmount: 300, applied: 300 }),
    preparedLine({ saleId: 11, customerId: 127, lineId: 1002, lineAmount: 1000, applied: 500, completesLine: false }),
  ];
  const completeMultiSale = [
    preparedLine({ saleId: 10, customerId: 102, lineId: 1001, lineAmount: 300, applied: 300 }),
    preparedLine({ saleId: 11, customerId: 127, lineId: 1002, lineAmount: 1000, applied: 400, previously: 600 }),
  ];

  assert.equal(isAutoConsolidationBatch(oneSale), false);
  assert.equal(isAutoConsolidationBatch(partialBatch), false);
  assert.equal(isAutoConsolidationBatch(completeMultiSale), true);
});

test('auto document reproduces the complete paid-ready batch and preserves source department/provenance', async () => {
  let createdData = null;
  const tx = {
    $queryRaw: async () => [{ locked: 1 }],
    consolidatedDeliveryLine: {
      findFirst: async () => null,
      findMany: async () => [],
    },
    combinedBillingDocument: {
      count: async () => 0,
      findFirst: async () => null,
      create: async ({ data }) => {
        createdData = data;
        return { id: 91, ...data, documentLines: data.documentLines.create, customer: { id: data.customerId } };
      },
    },
  };

  const document = await createSettlementConsolidatedDelivery({
    tx,
    branchId: 2,
    employeeId: 35,
    settlementId: 77,
    customerId: 35,
    prepared: [
      preparedLine({ saleId: 10, customerId: 102, lineId: 1001, lineAmount: 300, applied: 300 }),
      preparedLine({ saleId: 12, customerId: 127, lineId: 1003, lineAmount: 1000, applied: 400, previously: 600 }),
    ],
    note: 'ทดสอบ',
  });

  assert.equal(document.id, 91);
  assert.equal(createdData.customerId, 35);
  assert.equal(createdData.status, 'ISSUED');
  assert.equal(createdData.documentLines.create.length, 2);
  assert.equal(Number(createdData.totalAmount), 1300);
  assert.equal(createdData.documentLines.create[0].sourceSnapshot.sourceCustomerId, 102);
  assert.equal(createdData.documentLines.create[1].sourceSnapshot.sourceCustomerId, 127);
  assert.equal(createdData.documentLines.create[1].sourceSnapshot.previouslySettledAmount, 600);
  assert.equal(createdData.documentLines.create[1].sourceSnapshot.settlementAppliedAmount, 400);
  assert.equal(createdData.documentLines.create[0].sourceSnapshot.completedBySettlementId, 77);
  assert.equal(Number(createdData.documentLines.create[1].documentAmount), 1000);
});

test('single-delivery and partial batches do not create duplicate/incomplete combined delivery documents', async () => {
  let creates = 0;
  const tx = {
    consolidatedDeliveryLine: { findFirst: async () => null },
    combinedBillingDocument: { create: async () => { creates += 1; } },
  };

  const single = await createSettlementConsolidatedDelivery({
    tx,
    branchId: 2,
    employeeId: 35,
    settlementId: 80,
    customerId: 35,
    prepared: [preparedLine({ saleId: 10, customerId: 102, lineId: 1001, lineAmount: 300, applied: 300 })],
  });
  const partial = await createSettlementConsolidatedDelivery({
    tx,
    branchId: 2,
    employeeId: 35,
    settlementId: 81,
    customerId: 35,
    prepared: [
      preparedLine({ saleId: 10, customerId: 102, lineId: 1001, lineAmount: 300, applied: 300 }),
      preparedLine({ saleId: 11, customerId: 127, lineId: 1002, lineAmount: 1000, applied: 500, completesLine: false }),
    ],
  });

  assert.equal(single, null);
  assert.equal(partial, null);
  assert.equal(creates, 0);
});

test('idempotent replay resolves the same generated document from sourceSnapshot instead of creating another', async () => {
  let creates = 0;
  const tx = {
    consolidatedDeliveryLine: {
      findFirst: async () => ({ combinedBillingId: 91, status: 'DOCUMENTED' }),
    },
    combinedBillingDocument: {
      findFirst: async () => ({ id: 91, branchId: 2, code: 'CBL-X', status: 'ISSUED', documentLines: [], customer: { id: 35 } }),
      create: async () => { creates += 1; },
    },
  };
  const document = await createSettlementConsolidatedDelivery({ tx, branchId: 2, employeeId: 35, settlementId: 77, customerId: 35, prepared: [] });
  assert.equal(document.id, 91);
  assert.equal(creates, 0);
  const replay = await loadSettlementGeneratedDocument(tx, { branchId: 2, settlementId: 77 });
  assert.equal(replay.id, 91);
  assert.equal(replay.generationStatus, 'ACTIVE');
});

test('settlement detail exposes generated document and cancellation reverses it unless tax authority exists', () => {
  assert.match(querySettlement, /generatedDocument/);
  assert.match(querySettlement, /loadSettlementGeneratedDocument/);
  assert.match(cancelSettlement, /cancelGeneratedConsolidatedDelivery/);
  assert.match(cancelSettlement, /findSettlementGeneratedDocumentAnchor/);
  assert.match(cancelSettlement, /sourceType:\s*'CONSOLIDATED_DELIVERY'/);
  assert.match(cancelSettlement, /SETTLEMENT_GENERATED_DOCUMENT_TAX_EXISTS/);
  assert.match(cancelSettlement, /combinedBillingDocument\.update/);
  assert.match(cancelSettlement, /consolidatedDeliveryLine\.updateMany/);
  assert.match(cancelSettlement, /status:\s*'CANCELLED'/);
});
