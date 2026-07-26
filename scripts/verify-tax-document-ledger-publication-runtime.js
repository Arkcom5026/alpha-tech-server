const assert = require('node:assert/strict');

const {
  buildTaxDocumentDraft,
  createTaxDocumentLedgerPublicationRuntime,
} = require('../src/modules/tax');

const draft = buildTaxDocumentDraft({
  branchId: 3,
  sourceType: 'SALE',
  sourceId: '501',
  sourceVersion: 1,
  documentType: 'TAX_INVOICE',
  direction: 'OUTPUT',
  documentNumber: 'TX-000501',
  occurredAt: new Date('2026-07-26T10:00:00.000Z'),
  currency: 'THB',
  subtotalAmount: 1000,
  discountAmount: 0,
  taxableAmount: 1000,
  vatRate: 7,
  vatAmount: 70,
  totalAmount: 1070,
  commandKey: 'sale:501:complete',
  actorEmployeeId: 9,
  correlationId: 'corr-501',
});

const createDb = ({ failLedgerCreate = false } = {}) => {
  const state = {
    transactionCalls: 0,
    documentCreates: 0,
    ledgerCreates: 0,
    documents: [],
    ledgers: [],
  };

  const tx = {
    taxDocumentSource: {
      findFirst: async ({ where }) => {
        const document = state.documents.find(
          (item) =>
            item.sourceType === where.sourceType && item.sourceId === where.sourceId,
        );
        return document ? { taxDocument: document.taxDocument } : null;
      },
    },
    taxDocumentEvent: {},
    taxDocument: {
      create: async ({ data }) => {
        state.documentCreates += 1;
        const taxDocument = {
          id: `tax-document-${state.documentCreates}`,
          branchId: data.branchId,
          documentNumber: data.documentNumber,
          documentType: data.documentType,
          status: data.status,
          version: data.version,
        };
        state.documents.push({
          sourceType: data.sources.create.sourceType,
          sourceId: data.sources.create.sourceId,
          taxDocument,
        });
        return taxDocument;
      },
      findUnique: async ({ where }) => {
        const match = state.documents.find(
          (item) => item.taxDocument.id === where.id,
        );
        return match
          ? { id: match.taxDocument.id, branchId: match.taxDocument.branchId }
          : null;
      },
    },
    taxLedgerEntry: {
      findFirst: async ({ where }) =>
        state.ledgers.find(
          (item) =>
            item.taxDocumentId === where.taxDocumentId &&
            item.ledgerType === where.ledgerType,
        ) || null,
      create: async ({ data }) => {
        if (failLedgerCreate) {
          const error = new Error('forced ledger failure');
          error.code = 'FORCED_LEDGER_FAILURE';
          throw error;
        }
        state.ledgerCreates += 1;
        const ledgerEntry = { id: `ledger-${state.ledgerCreates}`, ...data };
        state.ledgers.push(ledgerEntry);
        return ledgerEntry;
      },
    },
  };

  const db = {
    $transaction: async (callback) => {
      state.transactionCalls += 1;
      return callback(tx);
    },
  };

  return { db, state };
};

const verify = async () => {
  const { db, state } = createDb();
  const runtime = createTaxDocumentLedgerPublicationRuntime({ db });

  const first = await runtime.publishDocumentAndLedger({ draft });
  assert.equal(state.transactionCalls, 1);
  assert.equal(state.documentCreates, 1);
  assert.equal(state.ledgerCreates, 1);
  assert.equal(first.documentPublication.created, true);
  assert.equal(first.ledgerPublication.created, true);
  assert.equal(first.ledgerEntryDraft.ledgerType, 'OUTPUT_VAT');
  assert.equal(first.ledgerEntryDraft.taxPeriodId, null);
  assert.equal(first.ledgerEntryDraft.reportingDate, null);
  assert.equal(Object.isFrozen(first), true);

  const replay = await runtime.publishDocumentAndLedger({ draft });
  assert.equal(state.transactionCalls, 2);
  assert.equal(state.documentCreates, 1);
  assert.equal(state.ledgerCreates, 1);
  assert.equal(replay.documentPublication.replayed, true);
  assert.equal(replay.ledgerPublication.replayed, true);

  assert.throws(
    () => createTaxDocumentLedgerPublicationRuntime({ db: {} }),
    (error) => error.code === 'INVALID_TAX_PUBLICATION_TRANSACTION_AUTHORITY',
  );

  await assert.rejects(
    () => runtime.publishDocumentAndLedger({ draft: { document: {} } }),
    (error) => error.code === 'INVALID_TAX_DOCUMENT_LEDGER_PUBLICATION_DRAFT',
  );

  const failing = createDb({ failLedgerCreate: true });
  const failingRuntime = createTaxDocumentLedgerPublicationRuntime({
    db: failing.db,
  });
  await assert.rejects(
    () => failingRuntime.publishDocumentAndLedger({ draft }),
    (error) => error.code === 'FORCED_LEDGER_FAILURE',
  );
  assert.equal(failing.state.transactionCalls, 1);
  assert.equal(failing.state.documentCreates, 1);
  assert.equal(failing.state.ledgerCreates, 0);

  process.stdout.write('Tax document ledger publication runtime verification: PASS\n');
};

verify().catch((error) => {
  console.error('Tax document ledger publication runtime verification: FAIL');
  console.error({ code: error.code || null, message: error.message });
  process.exitCode = 1;
});
