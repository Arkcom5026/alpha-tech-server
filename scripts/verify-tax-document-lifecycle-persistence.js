const assert = require('assert/strict');
const {
  TAX_DOCUMENT_LIFECYCLE_ACTIONS,
  issueDocument,
  createPrismaTaxDocumentLifecyclePersistence,
} = require('../src/modules/tax');

const clone = (value) => JSON.parse(JSON.stringify(value));

const createFakeTransactionClient = () => {
  const state = {
    documents: new Map([
      [
        'tax-doc-1',
        {
          id: 'tax-doc-1',
          branchId: 1,
          documentNumber: null,
          documentType: 'TAX_INVOICE',
          status: 'DRAFT',
          version: 1,
          validatedAt: null,
          issuedAt: null,
          reportedAt: null,
          lockedAt: null,
          cancelledAt: null,
          archivedAt: null,
        },
      ],
    ]),
    events: [],
  };

  const selectFields = (record, select) => {
    if (!record) return null;
    if (!select) return clone(record);

    return Object.fromEntries(
      Object.entries(select)
        .filter(([, enabled]) => enabled === true)
        .map(([key]) => [key, clone(record[key])]),
    );
  };

  const db = {
    taxDocument: {
      async findUnique({ where, select }) {
        return selectFields(state.documents.get(where.id) || null, select);
      },
      async updateMany({ where, data }) {
        const current = state.documents.get(where.id);
        if (!current || current.version !== where.version) return { count: 0 };

        state.documents.set(where.id, {
          ...current,
          ...clone(data),
        });

        return { count: 1 };
      },
    },
    taxDocumentEvent: {
      async findFirst({ where, select }) {
        const commandKey = where.metadata?.equals;
        const event = state.events.find(
          (candidate) =>
            candidate.taxDocumentId === where.taxDocumentId &&
            candidate.metadata?.commandKey === commandKey,
        );
        return selectFields(event || null, select);
      },
      async create({ data, select }) {
        const event = {
          id: `event-${state.events.length + 1}`,
          ...clone(data),
        };
        state.events.push(event);
        return selectFields(event, select);
      },
    },
  };

  return { db, state };
};

const command = {
  action: TAX_DOCUMENT_LIFECYCLE_ACTIONS.ISSUE,
  taxDocumentId: 'tax-doc-1',
  expectedVersion: 1,
  commandKey: 'issue-tax-doc-1',
  correlationId: 'corr-issue-1',
  actorEmployeeId: 7,
  occurredAt: new Date('2026-07-26T02:00:00.000Z'),
  reason: 'Verified for issue',
};

const verifyWriteAndReplay = async () => {
  const { db, state } = createFakeTransactionClient();
  const persistence = createPrismaTaxDocumentLifecyclePersistence({ db });
  const aggregate = await persistence.load('tax-doc-1');
  const transition = issueDocument(aggregate, command);

  const first = await persistence.persist(transition);

  assert.equal(first.written, true);
  assert.equal(first.replayed, false);
  assert.equal(first.taxDocument.status, 'ISSUED');
  assert.equal(first.taxDocument.version, 2);
  assert.equal(
    new Date(first.taxDocument.issuedAt).toISOString(),
    '2026-07-26T02:00:00.000Z',
  );
  assert.equal(first.event.eventType, 'ISSUED');
  assert.equal(first.event.metadata.commandKey, 'issue-tax-doc-1');
  assert.equal(first.event.metadata.aggregateVersion, 2);
  assert.equal(first.event.metadata.correlationId, 'corr-issue-1');
  assert.equal(state.events.length, 1);

  const replay = await persistence.persist(transition);

  assert.equal(replay.written, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.taxDocument.version, 2);
  assert.equal(state.events.length, 1);
};

const verifyOptimisticConcurrency = async () => {
  const { db, state } = createFakeTransactionClient();
  const persistence = createPrismaTaxDocumentLifecyclePersistence({ db });
  const aggregate = await persistence.load('tax-doc-1');
  const transition = issueDocument(aggregate, command);

  state.documents.set('tax-doc-1', {
    ...state.documents.get('tax-doc-1'),
    version: 2,
    status: 'ISSUED',
  });

  await assert.rejects(
    () => persistence.persist(transition),
    (error) =>
      error.code === 'TAX_DOCUMENT_VERSION_CONFLICT' &&
      error.details.actualVersion === 2 &&
      error.details.expectedVersion === 1,
  );
};

const verifyNotFound = async () => {
  const { db } = createFakeTransactionClient();
  const persistence = createPrismaTaxDocumentLifecyclePersistence({ db });

  await assert.rejects(
    () => persistence.load('missing-document'),
    (error) => error.code === 'TAX_DOCUMENT_NOT_FOUND',
  );
};

const run = async () => {
  await verifyWriteAndReplay();
  await verifyOptimisticConcurrency();
  await verifyNotFound();
  console.log('Tax Document Lifecycle Persistence: PASS');
};

run().catch((error) => {
  console.error('Tax Document Lifecycle Persistence: FAIL');
  console.error(error);
  process.exitCode = 1;
});
