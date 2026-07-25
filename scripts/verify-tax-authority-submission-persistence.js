const assert = require('assert');
const {
  createPrismaTaxAuthoritySubmissionPersistence,
  enqueueSubmission,
} = require('../src/modules/tax');

const main = async () => {
  const state = {
    submission: {
      id: 'sub-001',
      taxDocumentId: 'tax-doc-001',
      providerKey: 'MOCK',
      status: 'PENDING',
      version: 0,
    },
    events: [],
  };

  const db = {
    taxAuthoritySubmission: {
      async findUnique({ where }) {
        return where.id === state.submission.id ? { ...state.submission } : null;
      },
      async updateMany({ where, data }) {
        if (
          where.id !== state.submission.id ||
          where.version !== state.submission.version
        ) {
          return { count: 0 };
        }
        state.submission = { ...state.submission, ...data };
        return { count: 1 };
      },
    },
    taxAuthoritySubmissionEvent: {
      async findFirst({ where }) {
        return (
          state.events.find(
            (event) =>
              event.submissionId === where.submissionId &&
              event.metadata?.commandKey === where.metadata.equals,
          ) || null
        );
      },
      async create({ data }) {
        const event = { id: `event-${state.events.length + 1}`, ...data };
        state.events.push(event);
        return event;
      },
    },
  };

  const persistence = createPrismaTaxAuthoritySubmissionPersistence({ db });
  const transition = enqueueSubmission(state.submission, {
    action: 'ENQUEUE',
    submissionId: 'sub-001',
    taxDocumentId: 'tax-doc-001',
    providerKey: 'MOCK',
    expectedVersion: 0,
    commandKey: 'enqueue-sub-001-v1',
    correlationId: 'corr-001',
    actorEmployeeId: 7,
    occurredAt: '2026-07-26T00:00:00.000Z',
  });

  const written = await persistence.persist(transition);
  assert.strictEqual(written.written, true);
  assert.strictEqual(written.replayed, false);
  assert.strictEqual(written.submission.status, 'QUEUED');
  assert.strictEqual(written.submission.version, 1);
  assert.strictEqual(state.events.length, 1);
  assert.strictEqual(state.events[0].metadata.commandKey, 'enqueue-sub-001-v1');

  const replayed = await persistence.persist(transition);
  assert.strictEqual(replayed.written, false);
  assert.strictEqual(replayed.replayed, true);
  assert.strictEqual(state.events.length, 1);

  await assert.rejects(
    () =>
      createPrismaTaxAuthoritySubmissionPersistence({
        db: { taxAuthoritySubmission: {} },
      }).load('sub-001'),
    (error) =>
      error.code === 'INVALID_TAX_AUTHORITY_SUBMISSION_PERSISTENCE_CLIENT',
  );

  console.log('Tax Authority Submission Persistence: PASS');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
