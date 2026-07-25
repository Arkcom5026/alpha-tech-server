const assert = require('assert');
const {
  TaxAuthoritySubmissionDispatcherError,
  createMockTaxAuthorityProvider,
  createTaxAuthoritySubmissionDispatcher,
  createTaxAuthoritySubmissionQueue,
} = require('../src/modules/tax');

const main = async () => {
  const queue = createTaxAuthoritySubmissionQueue();
  const provider = createMockTaxAuthorityProvider({ providerKey: 'MOCK' });
  const dispatcher = createTaxAuthoritySubmissionDispatcher({
    providers: { MOCK: provider },
  });

  const item = Object.freeze({
    queueKey: 'tax-submission:sub-001:v1',
    submissionId: 'sub-001',
    taxDocumentId: 'tax-doc-001',
    providerKey: 'MOCK',
    occurredAt: new Date('2026-07-26T00:00:00.000Z'),
  });

  const first = queue.enqueue(item);
  assert.deepStrictEqual(first, { enqueued: true, replay: false, size: 1 });

  const replay = queue.enqueue(item);
  assert.deepStrictEqual(replay, { enqueued: false, replay: true, size: 1 });
  assert.strictEqual(queue.peek(), item);
  assert.strictEqual(queue.size(), 1);

  const dequeued = queue.dequeue();
  assert.strictEqual(dequeued, item);
  assert.strictEqual(queue.size(), 0);

  const submitted = await dispatcher.dispatch(dequeued);
  assert.strictEqual(submitted.providerKey, 'MOCK');
  assert.strictEqual(submitted.status, 'ACCEPTED');
  assert.strictEqual(submitted.accepted, true);

  const status = await dispatcher.getStatus(dequeued);
  assert.strictEqual(status.status, 'ACCEPTED');
  assert.strictEqual(status.externalReference, 'MOCK-sub-001');

  const cancelled = await dispatcher.cancel(dequeued);
  assert.strictEqual(cancelled.status, 'CANCELLED');

  const cancelledStatus = await dispatcher.getStatus(dequeued);
  assert.strictEqual(cancelledStatus.status, 'CANCELLED');

  await assert.rejects(
    () =>
      createTaxAuthoritySubmissionDispatcher({ providers: {} }).dispatch({
        ...item,
        providerKey: 'MISSING',
      }),
    (error) =>
      error instanceof TaxAuthoritySubmissionDispatcherError &&
      error.code === 'TAX_AUTHORITY_PROVIDER_NOT_FOUND',
  );

  console.log('Tax Authority Provider & Queue Foundation: PASS');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
