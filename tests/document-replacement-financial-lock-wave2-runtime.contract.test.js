'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  currentKeyFor,
  draftKeyFor,
  seedLinesFromAuthority,
} = require('../src/modules/sales/document-replacement/documentReplacementService');

(() => {
  assert.strictEqual(draftKeyFor(13, 2), '13:2:DRAFT');
  assert.strictEqual(currentKeyFor(13, 2), '13:2:CURRENT');

  const preparation = {
    id: 2,
    status: 'LOCKED',
    finalSnapshot: {
      lines: [
        {
          description: 'กระดาษดับเบิลเอ',
          quantity: 40,
          unitName: 'ชิ้น',
          unitPrice: 100,
          amount: 4000,
        },
      ],
      outOfBudgetService: {
        description: 'ค่าบริการ',
        quantity: 1,
        unitName: 'รายการ',
        unitPrice: 1000,
        amount: 1000,
        lineType: 'SERVICE_ONLY',
      },
    },
  };

  const seeded = seedLinesFromAuthority({ preparation, currentReplacement: null });
  assert.deepStrictEqual(seeded.map((line) => ({
    portion: line.portion,
    description: line.description,
    amount: line.amount,
    lineType: line.lineType,
  })), [
    {
      portion: 'IN_BUDGET',
      description: 'กระดาษดับเบิลเอ',
      amount: 4000,
      lineType: 'MANUAL_DOCUMENT_LINES',
    },
    {
      portion: 'OUT_OF_BUDGET',
      description: 'ค่าบริการ',
      amount: 1000,
      lineType: 'SERVICE_ONLY',
    },
  ]);

  const replacementSeed = seedLinesFromAuthority({
    preparation,
    currentReplacement: {
      finalSnapshot: {
        lines: [
          {
            portion: 'IN_BUDGET',
            description: 'วัสดุสำนักงาน',
            quantity: 1,
            unitName: 'รายการ',
            unitPrice: 4000,
            amount: 4000,
          },
          {
            portion: 'OUT_OF_BUDGET',
            description: 'ค่าบริการ',
            quantity: 1,
            unitName: 'รายการ',
            unitPrice: 1000,
            amount: 1000,
            lineType: 'SERVICE_ONLY',
          },
        ],
      },
    },
  });
  assert.strictEqual(replacementSeed[0].description, 'วัสดุสำนักงาน');
  assert.strictEqual(replacementSeed[1].lineType, 'SERVICE_ONLY');

  const serviceSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/sales/document-replacement/documentReplacementService.js'),
    'utf8',
  );
  const controllerSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/sales/document-replacement/documentReplacementController.js'),
    'utf8',
  );
  const routeSource = fs.readFileSync(
    path.join(__dirname, '../src/modules/sales/routes/saleRoutes.js'),
    'utf8',
  );

  assert.match(serviceSource, /preparation\.status !== 'LOCKED'/);
  assert.match(serviceSource, /assertReplacementFinancialLock/);
  assert.match(serviceSource, /saleDocumentReplacementLine\.deleteMany/);
  assert.match(serviceSource, /saleDocumentReplacementLine\.createMany/);
  assert.doesNotMatch(serviceSource, /stockItem\.(create|update|delete)/);
  assert.doesNotMatch(serviceSource, /saleItem\.(create|update|delete)/);
  assert.doesNotMatch(serviceSource, /taxDocument\.(create|update|delete)/);
  assert.doesNotMatch(serviceSource, /outputVatRecord\.(create|update|delete)/);

  assert.match(controllerSource, /createSaleDocumentReplacementController/);
  assert.match(controllerSource, /replaceSaleDocumentReplacementLinesController/);
  assert.match(routeSource, /post\('\/:id\/document-replacement'/);
  assert.match(routeSource, /get\('\/:id\/document-replacement'/);
  assert.match(routeSource, /put\('\/:id\/document-replacement\/lines'/);

  console.log('Document replacement financial lock Wave 2 runtime contract: PASS');
})();
