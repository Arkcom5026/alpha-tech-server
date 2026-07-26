const assert = require('node:assert/strict');

const {
  createPrismaTaxDocumentPublisher,
} = require('../src/modules/tax/infrastructure/prismaTaxDocumentPublisher');

const buildDraft = (branchId) => ({
  document: {
    branchId,
    documentNumber: null,
    documentType: 'ABBREVIATED_TAX_INVOICE',
    status: 'DRAFT',
    version: 1,
  },
  source: {
    sourceType: 'SALE',
    sourceId: '101',
  },
  event: {
    eventType: 'CREATED',
    performedByEmployeeId: 35,
    occurredAt: new Date('2026-07-27T00:00:00.000Z'),
    metadata: {},
  },
  identityKey: 'SALE:101:1',
  contentHash: 'hash-101',
});

const createDb = ({ existingTaxDocument = null } = {}) => {
  let createCalls = 0;

  return {
    db: {
      taxDocumentSource: {
        findFirst: async () =>
          existingTaxDocument ? { taxDocument: existingTaxDocument } : null,
      },
      taxDocument: {
        create: async ({ data }) => {
          createCalls += 1;
          return {
            id: 'tax-document-created',
            branchId: data.branchId,
            documentNumber: data.documentNumber,
            documentType: data.documentType,
            status: data.status,
            version: data.version,
          };
        },
      },
      taxDocumentEvent: {},
    },
    getCreateCalls: () => createCalls,
  };
};

const verifySameBranchReplay = async () => {
  const fixture = createDb({
    existingTaxDocument: {
      id: 'tax-document-existing',
      branchId: 2,
      documentNumber: null,
      documentType: 'ABBREVIATED_TAX_INVOICE',
      status: 'DRAFT',
      version: 1,
    },
  });

  const publisher = createPrismaTaxDocumentPublisher({ db: fixture.db });
  const result = await publisher.publish(buildDraft(2));

  assert.equal(result.created, false);
  assert.equal(result.replayed, true);
  assert.equal(result.taxDocument.branchId, 2);
  assert.equal(fixture.getCreateCalls(), 0);
};

const verifyCrossBranchReplayRefused = async () => {
  const fixture = createDb({
    existingTaxDocument: {
      id: 'tax-document-existing',
      branchId: 5,
      documentNumber: null,
      documentType: 'ABBREVIATED_TAX_INVOICE',
      status: 'DRAFT',
      version: 1,
    },
  });

  const publisher = createPrismaTaxDocumentPublisher({ db: fixture.db });

  await assert.rejects(
    () => publisher.publish(buildDraft(2)),
    (error) => {
      assert.equal(error.code, 'TAX_DOCUMENT_SOURCE_BRANCH_MISMATCH');
      assert.equal(error.details.requestedBranchId, 2);
      assert.equal(error.details.existingBranchId, 5);
      return true;
    },
  );

  assert.equal(fixture.getCreateCalls(), 0);
};

const verifyNewPublication = async () => {
  const fixture = createDb();
  const publisher = createPrismaTaxDocumentPublisher({ db: fixture.db });
  const result = await publisher.publish(buildDraft(2));

  assert.equal(result.created, true);
  assert.equal(result.replayed, false);
  assert.equal(result.taxDocument.branchId, 2);
  assert.equal(fixture.getCreateCalls(), 1);
};

const main = async () => {
  await verifySameBranchReplay();
  await verifyCrossBranchReplayRefused();
  await verifyNewPublication();

  console.log('Tax document publisher branch isolation: PASS');
};

main().catch((error) => {
  console.error('Tax document publisher branch isolation: FAIL');
  console.error(error);
  process.exitCode = 1;
});
