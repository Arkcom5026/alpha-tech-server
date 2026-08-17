'use strict';

const assert = require('node:assert/strict');
const {
  normalizeDescription,
  updateConsolidatedDocumentLine,
} = require('../src/modules/finance/combined-billing/documentLineService');

const run = async () => {
  assert.equal(normalizeDescription('  รายการสำหรับเอกสาร  '), 'รายการสำหรับเอกสาร');
  assert.equal(normalizeDescription('   '), null);

  const calls = [];
  const prisma = {
    combinedBillingDocument: {
      findFirst: async (args) => {
        calls.push(['document.findFirst', args]);
        return { id: 41 };
      },
    },
    consolidatedDeliveryLine: {
      updateMany: async (args) => {
        calls.push(['line.updateMany', args]);
        return { count: 1 };
      },
    },
  };

  const result = await updateConsolidatedDocumentLine({
    prisma,
    branchId: 2,
    documentId: 41,
    lineId: 501,
    description: '  ตลับหมึก HP 682 สีดำ  ',
  });

  assert.deepEqual(result, {
    success: true,
    documentId: 41,
    lineId: 501,
    description: 'ตลับหมึก HP 682 สีดำ',
  });

  const documentLookup = calls.find(([name]) => name === 'document.findFirst')[1];
  assert.deepEqual(documentLookup.where, { id: 41, branchId: 2 });

  const mutation = calls.find(([name]) => name === 'line.updateMany')[1];
  assert.deepEqual(mutation.where, {
    id: 501,
    combinedBillingId: 41,
    branchId: 2,
  });
  assert.deepEqual(mutation.data, { description: 'ตลับหมึก HP 682 สีดำ' });

  const forbiddenFinancialFields = [
    'quantity',
    'sourceUnitPrice',
    'documentUnitPrice',
    'priceAdjustment',
    'settledAmount',
    'documentAmount',
  ];
  for (const field of forbiddenFinancialFields) {
    assert.equal(Object.prototype.hasOwnProperty.call(mutation.data, field), false, `${field} must not be mutable`);
  }

  await assert.rejects(
    () => updateConsolidatedDocumentLine({
      prisma,
      branchId: 2,
      documentId: 41,
      lineId: 501,
      description: '   ',
    }),
    (error) => error?.code === 'CONSOLIDATED_DOCUMENT_LINE_DESCRIPTION_REQUIRED' && error?.statusCode === 400,
  );

  const wrongDocumentPrisma = {
    combinedBillingDocument: { findFirst: async () => null },
    consolidatedDeliveryLine: { updateMany: async () => { throw new Error('must not update'); } },
  };
  await assert.rejects(
    () => updateConsolidatedDocumentLine({
      prisma: wrongDocumentPrisma,
      branchId: 2,
      documentId: 99,
      lineId: 501,
      description: 'รายการใหม่',
    }),
    (error) => error?.code === 'CONSOLIDATED_DELIVERY_NOT_FOUND' && error?.statusCode === 404,
  );

  const wrongLinePrisma = {
    combinedBillingDocument: { findFirst: async () => ({ id: 41 }) },
    consolidatedDeliveryLine: { updateMany: async () => ({ count: 0 }) },
  };
  await assert.rejects(
    () => updateConsolidatedDocumentLine({
      prisma: wrongLinePrisma,
      branchId: 2,
      documentId: 41,
      lineId: 999,
      description: 'รายการใหม่',
    }),
    (error) => error?.code === 'CONSOLIDATED_DOCUMENT_LINE_NOT_FOUND' && error?.statusCode === 404,
  );

  console.log('Consolidated Document Line Description Contract: PASS');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
