'use strict';

const assert = require('node:assert/strict');
const {
  loadLegacySaleDeliveryNoteLifecycle,
} = require('../src/modules/sales/delivery-note/lifecycle/loadLegacySaleDeliveryNoteLifecycle');

const buildPrisma = ({
  sale,
  consolidated = null,
  directTax = null,
  preparation = null,
  preparedTax = null,
} = {}) => ({
  sale: {
    findFirst: async () => sale,
  },
  consolidatedDeliveryLine: {
    findFirst: async () => consolidated,
  },
  saleDocumentPreparation: {
    findUnique: async () => preparation,
  },
  taxCandidate: {
    findFirst: async ({ where }) => {
      if (where.sourceType === 'SALE') return directTax;
      if (where.sourceType === 'DOCUMENT_PREPARATION') return preparedTax;
      return null;
    },
  },
});

const sale = {
  id: 1046,
  code: 'SL-022608-0077',
  officialDocumentNumber: 'DN-SL-022608-0077',
  status: 'DRAFT',
  totalAmount: 1810,
  items: [{ id: 10, price: 1170, returnedQuantity: 0 }],
  simpleItems: [{ id: 20, quantity: 2, price: 640, returnedQuantity: 2 }],
};

(async () => {
  const adjusted = await loadLegacySaleDeliveryNoteLifecycle({
    prisma: buildPrisma({ sale }),
    branchId: 2,
    saleId: 1046,
  });
  assert.equal(adjusted.lifecycleState, 'ADJUSTED');
  assert.equal(adjusted.grossAmount, 1810);
  assert.equal(adjusted.returnedAmount, 640);
  assert.equal(adjusted.activeAmount, 1170);
  assert.equal(adjusted.compatibility.legacySaleBacked, true);
  assert.equal(adjusted.compatibility.successorPersistenceAvailable, false);
  assert.equal(adjusted.compatibility.financialLockReplacementIsLifecycleSuccessor, false);

  const consolidated = await loadLegacySaleDeliveryNoteLifecycle({
    prisma: buildPrisma({ sale, consolidated: { combinedBillingId: 88 } }),
    branchId: 2,
    saleId: 1046,
  });
  assert.equal(consolidated.lifecycleState, 'CONSOLIDATED');
  assert.equal(consolidated.activeConsolidation.combinedBillingId, 88);
  assert.equal(consolidated.actions.canPrintCurrent, false);

  const directTax = await loadLegacySaleDeliveryNoteLifecycle({
    prisma: buildPrisma({
      sale,
      directTax: {
        document: { id: 501, issuedDocumentNumber: 'TAX-000501', taxInvoiceKind: 'FULL' },
      },
    }),
    branchId: 2,
    saleId: 1046,
  });
  assert.equal(directTax.issuedTaxAuthority.sourceType, 'SALE');
  assert.equal(directTax.actions.requiresStatutoryCorrection, true);
  assert.equal(directTax.actions.canCreateAdjustedRevision, false);

  const preparedTax = await loadLegacySaleDeliveryNoteLifecycle({
    prisma: buildPrisma({
      sale,
      preparation: { id: 71 },
      preparedTax: {
        sourceId: '71:IN_BUDGET',
        document: { id: 601, issuedDocumentNumber: 'TAX-000601', taxInvoiceKind: 'FULL' },
      },
    }),
    branchId: 2,
    saleId: 1046,
  });
  assert.equal(preparedTax.issuedTaxAuthority.sourceType, 'DOCUMENT_PREPARATION');
  assert.equal(preparedTax.issuedTaxAuthority.sourceId, '71:IN_BUDGET');
  assert.equal(preparedTax.actions.canTaxHandoff, false);

  await assert.rejects(
    () => loadLegacySaleDeliveryNoteLifecycle({
      prisma: buildPrisma({ sale: { ...sale, officialDocumentNumber: null } }),
      branchId: 2,
      saleId: 1046,
    }),
    (error) => error?.code === 'DELIVERY_NOTE_NOT_ISSUED',
  );

  console.log('Delivery Note lifecycle compatibility loader contract: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
