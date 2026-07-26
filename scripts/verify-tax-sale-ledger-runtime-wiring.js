const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  publishDocumentAndLedgerInTransaction,
} = require('../src/modules/tax/application/taxDocumentLedgerPublicationRuntimeService');

const occurredAt = new Date('2026-07-27T01:00:00.000Z');

const draft = Object.freeze({
  identityKey: 'identity-key',
  contentHash: 'content-hash',
  document: Object.freeze({
    branchId: 7,
    documentNumber: 'TX-0001',
    documentType: 'TAX_INVOICE',
    status: 'DRAFT',
    version: 1,
  }),
  source: Object.freeze({
    sourceType: 'SALE',
    sourceId: '101',
    sourceVersion: 1,
  }),
  snapshot: Object.freeze({
    direction: 'OUTPUT',
    occurredAt,
    taxableAmount: 1000,
    vatAmount: 70,
    totalAmount: 1070,
  }),
  event: Object.freeze({
    eventType: 'CREATED',
    occurredAt,
    performedByEmployeeId: 9,
    metadata: Object.freeze({ commandKey: 'sale-command-1' }),
  }),
});

const createTx = () => {
  const state = {
    documentCreates: 0,
    ledgerCreates: 0,
    taxDocument: null,
    ledgerEntry: null,
  };

  const tx = {
    taxDocumentSource: {
      findFirst: async () => null,
    },
    taxDocumentEvent: {},
    taxDocument: {
      create: async ({ data }) => {
        state.documentCreates += 1;
        state.taxDocument = {
          id: 'tax-doc-1',
          branchId: data.branchId,
          documentNumber: data.documentNumber,
          documentType: data.documentType,
          status: data.status,
          version: data.version,
        };
        return state.taxDocument;
      },
      findUnique: async () => state.taxDocument,
    },
    taxLedgerEntry: {
      findFirst: async () => state.ledgerEntry,
      create: async ({ data }) => {
        state.ledgerCreates += 1;
        state.ledgerEntry = { id: 'ledger-1', ...data };
        return state.ledgerEntry;
      },
    },
  };

  return { tx, state };
};

const verifyInTransactionPublication = async () => {
  const { tx, state } = createTx();
  const result = await publishDocumentAndLedgerInTransaction({
    tx,
    draft,
    postingDate: occurredAt,
    effectiveDate: occurredAt,
  });

  assert.equal(state.documentCreates, 1);
  assert.equal(state.ledgerCreates, 1);
  assert.equal(result.documentPublication.created, true);
  assert.equal(result.ledgerPublication.created, true);
  assert.equal(result.ledgerEntryDraft.taxDocumentId, 'tax-doc-1');
  assert.equal(result.ledgerEntryDraft.branchId, 7);
  assert.equal(result.ledgerEntryDraft.ledgerType, 'OUTPUT_VAT');
  assert.equal(result.ledgerEntryDraft.taxPeriodId, null);
  assert.equal(result.ledgerEntryDraft.reportingDate, null);
};

const verifyInvalidTransactionClient = async () => {
  await assert.rejects(
    () => publishDocumentAndLedgerInTransaction({ tx: {}, draft }),
    (error) => error.code === 'INVALID_TAX_PUBLICATION_TRANSACTION_CLIENT',
  );
};

const verifySaleCompletionWiring = () => {
  const servicePath = path.join(
    process.cwd(),
    'src/modules/sales/completion/services/saleCompletionService.js',
  );
  const source = fs.readFileSync(servicePath, 'utf8');

  assert.match(source, /publishDocumentAndLedgerInTransaction/);
  assert.match(source, /createSaleTaxProjectionRuntime/);
  assert.match(source, /publish:\s*\(draft\)\s*=>\s*publishDocumentAndLedgerInTransaction/);
  assert.match(source, /tx,\s*\n\s*defaultDraft|tx,\s*\n\s*draft/);
  assert.doesNotMatch(source, /createPrismaTaxDocumentPublisher/);
  assert.doesNotMatch(source, /\$transaction\s*\(/);
};

const run = async () => {
  await verifyInTransactionPublication();
  await verifyInvalidTransactionClient();
  verifySaleCompletionWiring();
  process.stdout.write('Sale tax ledger runtime wiring verification: PASS\n');
};

run().catch((error) => {
  console.error('Sale tax ledger runtime wiring verification: FAIL');
  console.error({ code: error.code || null, message: error.message });
  process.exitCode = 1;
});
