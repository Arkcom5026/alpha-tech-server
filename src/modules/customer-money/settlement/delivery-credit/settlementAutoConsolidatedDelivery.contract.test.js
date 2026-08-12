'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Prisma } = require('../../../../../lib/prisma');
const {
  createSettlementConsolidatedDelivery,
} = require('../../../finance/combined-billing/create/createSettlementConsolidatedDelivery');

const read = (relative) => fs.readFileSync(path.join(__dirname, relative), 'utf8');
const createSettlement = read('createDeliveryCreditSettlementService.js');
const cancelSettlement = read('cancelDeliveryCreditSettlementService.js');
const querySettlement = read('queryDeliveryCreditSettlementService.js');
const generator = read('../../../finance/combined-billing/create/createSettlementConsolidatedDelivery.js');
const authoritySchema = fs.readFileSync(path.join(__dirname, '../../../../../prisma/customer/customer-money-settlement-document.prisma'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '../../../../../prisma/migrations/20260812183000_customer_money_settlement_generated_document/migration.sql'), 'utf8');

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
});

test('generated document authority is durable and one-to-one per settlement', () => {
  assert.match(authoritySchema, /model CustomerMoneySettlementGeneratedDocument/);
  assert.match(authoritySchema, /settlementId\s+Int\s+@unique/);
  assert.match(authoritySchema, /combinedBillingId\s+Int\s+@unique/);
  assert.match(migration, /CREATE TABLE "public"\."CustomerMoneySettlementGeneratedDocument"/);
  assert.match(migration, /CustomerMoneySettlementGeneratedDocument_settlementId_key/);
  assert.match(migration, /CustomerMoneySettlementGeneratedDocument_combinedBillingId_key/);
});

test('auto document contains only lines that become paid-ready and preserves prior partial settlement provenance', async () => {
  let createdData = null;
  let linkData = null;
  const tx = {
    customerMoneySettlementGeneratedDocument: {
      findUnique: async () => null,
      create: async ({ data }) => { linkData = data; return { id: 1, ...data }; },
    },
    consolidatedDeliveryLine: { findMany: async () => [] },
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
      preparedLine({ saleId: 11, customerId: 127, lineId: 1002, lineAmount: 1000, applied: 500, completesLine: false }),
      preparedLine({ saleId: 12, customerId: 127, lineId: 1003, lineAmount: 1000, applied: 400, previously: 600, completesLine: true }),
    ],
    note: 'ทดสอบ',
  });

  assert.equal(document.id, 91);
  assert.equal(createdData.customerId, 35);
  assert.equal(createdData.status, 'ISSUED');
  assert.equal(createdData.documentLines.create.length, 2);
  assert.equal(Number(createdData.totalAmount), 1300);
  assert.equal(createdData.documentLines.create[0].sourceCustomerId, undefined);
  assert.equal(createdData.documentLines.create[0].sourceSnapshot.sourceCustomerId, 102);
  assert.equal(createdData.documentLines.create[1].sourceSnapshot.previouslySettledAmount, 600);
  assert.equal(Number(createdData.documentLines.create[1].documentAmount), 1000);
  assert.deepEqual(linkData, { branchId: 2, settlementId: 77, combinedBillingId: 91, status: 'ACTIVE' });
});

test('idempotent replay reuses the generated document instead of creating another', async () => {
  let creates = 0;
  const tx = {
    customerMoneySettlementGeneratedDocument: {
      findUnique: async () => ({ id: 5, branchId: 2, settlementId: 77, combinedBillingId: 91, status: 'ACTIVE' }),
    },
    combinedBillingDocument: {
      findFirst: async () => ({ id: 91, branchId: 2, code: 'CBL-X', documentLines: [], customer: { id: 35 } }),
      create: async () => { creates += 1; },
    },
  };
  const document = await createSettlementConsolidatedDelivery({ tx, branchId: 2, employeeId: 35, settlementId: 77, customerId: 35, prepared: [] });
  assert.equal(document.id, 91);
  assert.equal(creates, 0);
});

test('settlement detail exposes generated document and cancellation reverses it unless tax authority exists', () => {
  assert.match(querySettlement, /generatedDocument/);
  assert.match(querySettlement, /customerMoneySettlementGeneratedDocument\.findUnique/);
  assert.match(cancelSettlement, /cancelGeneratedConsolidatedDelivery/);
  assert.match(cancelSettlement, /sourceType:\s*'CONSOLIDATED_DELIVERY'/);
  assert.match(cancelSettlement, /SETTLEMENT_GENERATED_DOCUMENT_TAX_EXISTS/);
  assert.match(cancelSettlement, /combinedBillingDocument\.update/);
  assert.match(cancelSettlement, /consolidatedDeliveryLine\.updateMany/);
  assert.match(cancelSettlement, /status:\s*'CANCELLED'/);
});
