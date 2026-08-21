'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  loadUnconsumedCompletedReturns,
  isPrismaRevisionWriteConflict,
} = require('../src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionService');
const {
  deriveDeliveryNoteRevisionNumber,
} = require('../src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionNumberPolicy');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

(async () => {
  let capturedSaleReturnWhere = null;
  const tx = {
    deliveryNoteDocumentReturnSource: {
      findMany: async () => [{ saleReturnId: 71 }, { saleReturnId: 72 }, { saleReturnId: 71 }],
    },
    saleReturn: {
      findMany: async (args) => {
        capturedSaleReturnWhere = args.where;
        return [];
      },
    },
  };

  await loadUnconsumedCompletedReturns(tx, { branchId: 2, saleId: 1046 });
  assert.equal(capturedSaleReturnWhere.branchId, 2);
  assert.equal(capturedSaleReturnWhere.saleId, 1046);
  assert.equal(capturedSaleReturnWhere.status, 'COMPLETED');
  assert.deepEqual(capturedSaleReturnWhere.id.notIn, [71, 72]);

  assert.equal(isPrismaRevisionWriteConflict({ code: 'P2034' }), true);
  assert.equal(isPrismaRevisionWriteConflict({ code: 'P2002' }), true);
  assert.equal(isPrismaRevisionWriteConflict({ code: 'P2025' }), false);

  assert.equal(
    deriveDeliveryNoteRevisionNumber({ originalDocumentNumber: 'DN-SL-022608-0077', revisionNumber: 2 }),
    'DN-SL-022608-0077-R2',
  );

  const revisionService = read('src/modules/sales/delivery-note/lifecycle/deliveryNoteRevisionService.js');
  assert.match(revisionService, /deliveryNoteDocumentReturnSource\.findMany/);
  assert.match(revisionService, /id:\s*\{\s*notIn:\s*consumedIds\s*\}/);
  assert.doesNotMatch(revisionService, /returnedAt:\s*\{\s*gt:\s*predecessor\.issuedAt/);
  assert.match(revisionService, /DELIVERY_NOTE_REVISION_WRITE_CONFLICT/);

  const historicalProjector = read('src/modules/sales/documents/print/projectHistoricalSaleDeliveryNoteRevisionService.js');
  const revisionLookupIndex = historicalProjector.indexOf('await getDeliveryNoteRevisionById');
  const legacyProjectionIndex = historicalProjector.indexOf('await projectSaleDeliveryNote');
  assert.ok(revisionLookupIndex >= 0 && legacyProjectionIndex > revisionLookupIndex,
    'historical revision must resolve before presentation projection');

  const baseProjector = read('src/modules/sales/documents/print/projectSaleDeliveryNoteService.js');
  assert.match(baseProjector, /sale\.status === 'CANCELLED'\s*&&\s*historicalRead !== true/);

  const issuance = read('src/modules/sales/documents/issue/issueSaleDeliveryNoteService.js');
  assert.match(issuance, /const documentNumber = `DN-\$\{sale\.code\}`/,
    'revision numbering remains rooted in the existing deterministic Delivery Note authority');

  console.log('Delivery Note lifecycle Wave 2I production authority hardening contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
