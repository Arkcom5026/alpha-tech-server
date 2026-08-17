'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  normalizeDocumentText,
  updateConsolidatedDocumentLine,
} = require('../src/modules/finance/combined-billing/documentLineService');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

const run = async () => {
  const routesSource = read('src/modules/finance/combined-billing/routes/combinedBillingRoutes.js');
  const controllerSource = read('src/modules/finance/combined-billing/documentLineController.js');
  const historySource = read('src/modules/finance/combined-billing/documentHistoryController.js');
  const schemaSource = read('prisma/consolidated-delivery-presentation.prisma');

  assert.ok(
    routesSource.includes("router.put('/consolidated-deliveries/:id/document-lines/:lineId', documentLine.update);"),
    'Consolidated document-line mutation must use the dedicated line route.',
  );
  assert.ok(
    controllerSource.includes('documentPrefix: req.body?.documentPrefix')
      && controllerSource.includes('documentDescription: req.body?.documentDescription')
      && controllerSource.includes('documentSuffix: req.body?.documentSuffix')
      && !controllerSource.includes('quantity: req.body')
      && !controllerSource.includes('documentUnitPrice: req.body')
      && !controllerSource.includes('priceAdjustment: req.body')
      && !controllerSource.includes('documentAmount: req.body'),
    'HTTP controller must accept only document presentation fields.',
  );
  assert.match(schemaSource, /model ConsolidatedDeliveryLinePresentation/);
  assert.match(schemaSource, /documentPrefix\s+String\?/);
  assert.match(schemaSource, /documentDescription\s+String\?/);
  assert.match(schemaSource, /documentSuffix\s+String\?/);
  assert.match(historySource, /consolidatedDeliveryLinePresentation\.findMany/);

  assert.equal(normalizeDocumentText('  บริการเปลี่ยน  '), 'บริการเปลี่ยน');
  assert.equal(normalizeDocumentText('   '), null);

  const calls = [];
  const prisma = {
    combinedBillingDocument: {
      findFirst: async (args) => {
        calls.push(['document.findFirst', args]);
        return { id: 41 };
      },
    },
    consolidatedDeliveryLine: {
      findFirst: async (args) => {
        calls.push(['line.findFirst', args]);
        return { id: 501 };
      },
    },
    consolidatedDeliveryLinePresentation: {
      upsert: async (args) => {
        calls.push(['presentation.upsert', args]);
        return {
          documentPrefix: args.create.documentPrefix,
          documentDescription: args.create.documentDescription,
          documentSuffix: args.create.documentSuffix,
        };
      },
    },
  };

  const result = await updateConsolidatedDocumentLine({
    prisma,
    branchId: 2,
    documentId: 41,
    lineId: 501,
    employeeId: 35,
    documentPrefix: '  บริการเปลี่ยน  ',
    documentDescription: 'หัวพิมพ์ Canon BH-7 BK (Black) Printhead',
    documentSuffix: '  รับประกันงาน 30 วัน  ',
  });

  assert.equal(result.success, true);
  assert.equal(result.documentId, 41);
  assert.equal(result.lineId, 501);
  assert.deepEqual(result.presentation, {
    documentPrefix: 'บริการเปลี่ยน',
    documentDescription: 'หัวพิมพ์ Canon BH-7 BK (Black) Printhead',
    documentSuffix: 'รับประกันงาน 30 วัน',
  });

  const mutation = calls.find(([name]) => name === 'presentation.upsert')[1];
  assert.deepEqual(mutation.create, {
    branchId: 2,
    combinedBillingId: 41,
    consolidatedDeliveryLineId: 501,
    documentPrefix: 'บริการเปลี่ยน',
    documentDescription: 'หัวพิมพ์ Canon BH-7 BK (Black) Printhead',
    documentSuffix: 'รับประกันงาน 30 วัน',
    updatedById: 35,
  });

  const serialized = JSON.stringify(mutation);
  for (const field of ['quantity', 'sourceUnitPrice', 'documentUnitPrice', 'priceAdjustment', 'settledAmount', 'documentAmount']) {
    assert.equal(serialized.includes(`\"${field}\"`), false, `${field} must not be mutable`);
  }

  console.log('Consolidated Document Line Presentation Contract: PASS');
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
