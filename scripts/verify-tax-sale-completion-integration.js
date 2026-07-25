const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  TAX_DOCUMENT_TYPES,
  createPrismaTaxDocumentPublisher,
  createSaleTaxProjectionRuntime,
  projectCompletedSaleToTaxDocument,
} = require('../src/modules/tax');

const root = path.resolve(__dirname, '..');
const saleCompletionServicePath = path.join(
  root,
  'src/modules/sales/completion/services/saleCompletionService.js',
);

const createMockTransactionClient = () => {
  const state = {
    existingSource: null,
    createdDocuments: [],
  };

  return {
    state,
    taxDocumentSource: {
      findFirst: async () => state.existingSource,
    },
    taxDocumentEvent: {},
    taxDocument: {
      create: async ({ data }) => {
        const taxDocument = {
          id: `tax-${state.createdDocuments.length + 1}`,
          branchId: data.branchId,
          documentNumber: data.documentNumber,
          documentType: data.documentType,
          status: data.status,
          version: data.version,
        };

        state.createdDocuments.push({ data, taxDocument });
        state.existingSource = { taxDocument };
        return taxDocument;
      },
    },
  };
};

const buildCompletedSale = () => ({
  id: 501,
  branchId: 7,
  employeeId: 22,
  totalBeforeDiscount: 1000,
  totalDiscount: 0,
  totalAmount: 1070,
  vat: 70,
  vatRate: 7,
  isTaxInvoice: false,
  officialDocumentNumber: null,
  createdAt: new Date('2026-07-25T00:00:00.000Z'),
});

const verifyProjectionContract = () => {
  const draft = projectCompletedSaleToTaxDocument({
    sale: buildCompletedSale(),
    commandKey: 'sale-complete-501',
    correlationId: 'sale-complete-501',
  });

  assert.equal(draft.document.documentType, TAX_DOCUMENT_TYPES.ABBREVIATED_TAX_INVOICE);
  assert.equal(draft.document.status, 'DRAFT');
  assert.equal(draft.source.sourceType, 'SALE');
  assert.equal(draft.source.sourceId, '501');
  assert.equal(draft.snapshot.totalAmount, '1070.00');
  assert.equal(draft.snapshot.vatAmount, '70.00');
  assert.equal(draft.event.metadata.commandKey, 'sale-complete-501');
  assert.equal(Object.isFrozen(draft), true);
};

const verifyPublisherReplaySafety = async () => {
  const db = createMockTransactionClient();
  const publisher = createPrismaTaxDocumentPublisher({ db });
  const runtime = createSaleTaxProjectionRuntime({ publisher });

  const first = await runtime.projectAndPublishCompletedSale({
    sale: buildCompletedSale(),
    commandKey: 'sale-complete-501',
    correlationId: 'sale-complete-501',
  });

  assert.equal(first.publication.created, true);
  assert.equal(first.publication.replayed, false);
  assert.equal(db.state.createdDocuments.length, 1);

  const second = await runtime.projectAndPublishCompletedSale({
    sale: buildCompletedSale(),
    commandKey: 'sale-complete-501',
    correlationId: 'sale-complete-501',
  });

  assert.equal(second.publication.created, false);
  assert.equal(second.publication.replayed, true);
  assert.equal(db.state.createdDocuments.length, 1);
};

const verifyTransactionIntegrationShape = () => {
  const source = fs.readFileSync(saleCompletionServicePath, 'utf8');

  assert.match(source, /createPrismaTaxDocumentPublisher/);
  assert.match(source, /createSaleTaxProjectionRuntime/);
  assert.match(source, /createPrismaTaxDocumentPublisher\(\{ db: tx \}\)/);
  assert.match(source, /projectAndPublishCompletedSale\(\{/);
  assert.match(source, /commandKey:\s*command\.commandKey/);
  assert.match(source, /correlationId:\s*command\.commandKey/);

  const transactionStart = source.indexOf('runCompletionTransaction(async (tx) =>');
  const taxPublication = source.indexOf('projectAndPublishCompletedSale({');
  const transactionReturn = source.indexOf('return { saleId: sale.id, payments: posted.payments };');

  assert.ok(transactionStart >= 0, 'Sale completion transaction boundary is missing');
  assert.ok(taxPublication > transactionStart, 'Tax publication must run inside the sale transaction');
  assert.ok(transactionReturn > taxPublication, 'Transaction must return only after tax publication');
};

const run = async () => {
  verifyProjectionContract();
  await verifyPublisherReplaySafety();
  verifyTransactionIntegrationShape();
  console.log('Tax Sale Completion Integration: PASS');
};

run().catch((error) => {
  console.error('Tax Sale Completion Integration: FAIL');
  console.error(error);
  process.exitCode = 1;
});