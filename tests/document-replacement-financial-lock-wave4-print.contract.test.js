'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildCurrentReplacementPrintProjection,
} = require('../src/modules/sales/document-replacement/documentReplacementPrintProjection');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const replacement = {
  id: 7,
  preparationId: 2,
  replacementNumber: 2,
  replacesReplacementId: 6,
  status: 'LOCKED',
  reason: 'หน่วยงานขอจัดรายการใหม่',
  lockedAt: new Date('2026-08-20T08:00:00.000Z'),
  finalSnapshot: {
    replacementNumber: 2,
    totals: {
      sourceTotal: 5000,
      inBudgetTotal: 4000,
      outOfBudgetTotal: 1000,
    },
    lines: [
      {
        portion: 'IN_BUDGET',
        description: 'วัสดุสำนักงาน',
        quantity: 1,
        unitName: 'รายการ',
        unitPrice: 2500,
        amount: 2500,
        lineType: 'MANUAL_DOCUMENT_LINES',
        sortOrder: 0,
      },
      {
        portion: 'OUT_OF_BUDGET',
        description: 'ค่าบริการ',
        quantity: 1,
        unitName: 'รายการ',
        unitPrice: 1000,
        amount: 1000,
        lineType: 'SERVICE_ONLY',
        sortOrder: 0,
      },
      {
        portion: 'IN_BUDGET',
        description: 'วัสดุสิ้นเปลือง',
        quantity: 1,
        unitName: 'รายการ',
        unitPrice: 1500,
        amount: 1500,
        lineType: 'MANUAL_DOCUMENT_LINES',
        sortOrder: 1,
      },
    ],
  },
};

const projection = buildCurrentReplacementPrintProjection({ replacement });
assert.ok(projection);
assert.strictEqual(projection.replacementId, 7);
assert.strictEqual(projection.replacementNumber, 2);
assert.strictEqual(projection.replacesReplacementId, 6);
assert.strictEqual(projection.lines.length, 2, 'delivery-note projection must contain IN_BUDGET lines only');
assert.deepStrictEqual(projection.lines.map((line) => line.description), ['วัสดุสำนักงาน', 'วัสดุสิ้นเปลือง']);
assert.strictEqual(projection.lines.reduce((sum, line) => sum + line.lineAmount, 0), 4000);
assert.strictEqual(projection.totals.sourceTotal, 5000);
assert.strictEqual(projection.totals.inBudgetTotal, 4000);
assert.strictEqual(projection.totals.outOfBudgetTotal, 1000);
assert.strictEqual(buildCurrentReplacementPrintProjection({ replacement: { ...replacement, status: 'DRAFT' } }), null);
assert.strictEqual(buildCurrentReplacementPrintProjection({ replacement: null }), null);

const deliveryProjection = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');
assert.match(deliveryProjection, /loadCurrentReplacementPrintProjection/);
assert.match(deliveryProjection, /saleDocumentPreparation\.findUnique/);
assert.match(deliveryProjection, /preparation\?\.status === 'LOCKED'/);
assert.match(deliveryProjection, /currentReplacement\?\.lines\?\.length/);
assert.match(deliveryProjection, /replacementProjection: currentReplacement/);
assert.match(deliveryProjection, /replacement: currentReplacement/);
assert.match(deliveryProjection, /documentNumber: sale\.officialDocumentNumber/);
assert.doesNotMatch(deliveryProjection, /officialDocumentNumber\s*=/);

console.log('Document replacement financial lock Wave 4 print contract: PASS');
