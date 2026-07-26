const assert = require('node:assert/strict');
const {
  createPrismaTaxLedgerPublisher,
} = require('../src/modules/tax/infrastructure/prismaTaxLedgerPublisher');

const date = new Date('2026-07-01T00:00:00.000Z');
const baseEntry = Object.freeze({
  taxDocumentId: 'tax-doc-1',
  branchId: 7,
  taxPeriodId: null,
  ledgerType: 'OUTPUT_VAT',
  postingDate: date,
  effectiveDate: date,
  reportingDate: null,
  taxBase: 1000,
  vatAmount: 70,
  totalAmount: 1070,
  version: 1,
});

const cloneEntry = (overrides = {}) => ({ ...baseEntry, ...overrides });

const makeDb = ({ documentBranchId = 7, existing = null } = {}) => {
  const calls = { create: 0 };
  const db = {
    taxDocument: {
      findUnique: async () => ({ id: 'tax-doc-1', branchId: documentBranchId }),
    },
    taxLedgerEntry: {
      findFirst: async () => existing,
      create: async ({ data }) => {
        calls.create += 1;
        return { id: 'ledger-1', ...data };
      },
    },
  };
  return { db, calls };
};

const expectCode = async (fn, code) => {
  await assert.rejects(fn, (error) => {
    assert.equal(error.code, code);
    return true;
  });
};

const run = async () => {
  {
    const { db, calls } = makeDb();
    const publisher = createPrismaTaxLedgerPublisher({ db });
    const result = await publisher.publish(cloneEntry());
    assert.equal(result.created, true);
    assert.equal(result.replayed, false);
    assert.equal(result.ledgerEntry.branchId, 7);
    assert.equal(calls.create, 1);
  }

  {
    const existing = { id: 'ledger-1', ...cloneEntry() };
    const { db, calls } = makeDb({ existing });
    const publisher = createPrismaTaxLedgerPublisher({ db });
    const result = await publisher.publish(cloneEntry());
    assert.equal(result.created, false);
    assert.equal(result.replayed, true);
    assert.equal(result.ledgerEntry.id, 'ledger-1');
    assert.equal(calls.create, 0);
  }

  {
    const existing = { id: 'ledger-1', ...cloneEntry({ vatAmount: 69 }) };
    const { db, calls } = makeDb({ existing });
    const publisher = createPrismaTaxLedgerPublisher({ db });
    await expectCode(
      () => publisher.publish(cloneEntry()),
      'TAX_LEDGER_REPLAY_CONFLICT',
    );
    assert.equal(calls.create, 0);
  }

  {
    const { db, calls } = makeDb({ documentBranchId: 8 });
    const publisher = createPrismaTaxLedgerPublisher({ db });
    await expectCode(
      () => publisher.publish(cloneEntry()),
      'TAX_LEDGER_DOCUMENT_BRANCH_MISMATCH',
    );
    assert.equal(calls.create, 0);
  }

  {
    const { db } = makeDb();
    db.taxDocument.findUnique = async () => null;
    const publisher = createPrismaTaxLedgerPublisher({ db });
    await expectCode(
      () => publisher.publish(cloneEntry()),
      'TAX_LEDGER_DOCUMENT_NOT_FOUND',
    );
  }

  {
    assert.throws(
      () => createPrismaTaxLedgerPublisher({ db: { taxDocument: {} } }),
      (error) => error.code === 'INVALID_TAX_LEDGER_PERSISTENCE_CLIENT',
    );
  }

  process.stdout.write('Tax ledger publisher verification: PASS\n');
};

run().catch((error) => {
  console.error('Tax ledger publisher verification: FAIL');
  console.error(error);
  process.exitCode = 1;
});
