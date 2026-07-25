class TaxAuthoritySubmissionQueueError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxAuthoritySubmissionQueueError';
    this.code = code;
    this.details = details;
  }
}

const createTaxAuthoritySubmissionQueue = () => {
  const items = [];
  const knownKeys = new Set();

  return Object.freeze({
    enqueue(item) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TaxAuthoritySubmissionQueueError(
          'INVALID_TAX_AUTHORITY_QUEUE_ITEM',
          'Queue item must be an object',
        );
      }

      const queueKey = String(item.queueKey ?? '').trim();
      if (!queueKey) {
        throw new TaxAuthoritySubmissionQueueError(
          'INVALID_TAX_AUTHORITY_QUEUE_ITEM',
          'queueKey is required',
        );
      }

      if (knownKeys.has(queueKey)) {
        return Object.freeze({ enqueued: false, replay: true, size: items.length });
      }

      const queuedItem = Object.freeze({ ...item, queueKey });
      items.push(queuedItem);
      knownKeys.add(queueKey);
      return Object.freeze({ enqueued: true, replay: false, size: items.length });
    },

    dequeue() {
      return items.shift() ?? null;
    },

    peek() {
      return items[0] ?? null;
    },

    size() {
      return items.length;
    },
  });
};

module.exports = {
  TaxAuthoritySubmissionQueueError,
  createTaxAuthoritySubmissionQueue,
};
