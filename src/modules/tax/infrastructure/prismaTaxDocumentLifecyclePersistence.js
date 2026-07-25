const {
  TaxDocumentLifecycleRuntimeError,
} = require('../application/taxDocumentLifecycleRuntime');

class TaxDocumentLifecyclePersistenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxDocumentLifecyclePersistenceError';
    this.code = code;
    this.details = details;
  }
}

const requireTransactionClient = (db) => {
  const requiredModels = ['taxDocument', 'taxDocumentEvent'];
  const missingModels = requiredModels.filter((modelName) => !db?.[modelName]);

  if (missingModels.length > 0) {
    throw new TaxDocumentLifecyclePersistenceError(
      'INVALID_TAX_LIFECYCLE_PERSISTENCE_CLIENT',
      'Tax lifecycle persistence requires a Prisma transaction client',
      { missingModels },
    );
  }

  return db;
};

const selectAggregate = {
  id: true,
  branchId: true,
  documentNumber: true,
  documentType: true,
  status: true,
  version: true,
  validatedAt: true,
  issuedAt: true,
  reportedAt: true,
  lockedAt: true,
  cancelledAt: true,
  archivedAt: true,
};

const toPerformedBy = (value) => {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
};

const lifecycleTimestampData = (event) => {
  switch (event.eventType) {
    case 'ISSUED':
      return { issuedAt: event.occurredAt };
    case 'CANCELLED':
      return { cancelledAt: event.occurredAt };
    default:
      return {};
  }
};

const validateTransitionResult = (result) => {
  if (!result?.aggregate || !result?.event) {
    throw new TaxDocumentLifecyclePersistenceError(
      'INVALID_TAX_LIFECYCLE_TRANSITION_RESULT',
      'Lifecycle transition result must contain aggregate and event',
    );
  }

  const { aggregate, event } = result;

  if (String(aggregate.id) !== String(event.aggregateId)) {
    throw new TaxDocumentLifecyclePersistenceError(
      'TAX_DOCUMENT_IDENTITY_MISMATCH',
      'Lifecycle aggregate and event target different tax documents',
    );
  }

  if (aggregate.version !== event.aggregateVersion) {
    throw new TaxDocumentLifecyclePersistenceError(
      'TAX_DOCUMENT_VERSION_MISMATCH',
      'Lifecycle aggregate and event versions must match',
      {
        aggregateVersion: aggregate.version,
        eventVersion: event.aggregateVersion,
      },
    );
  }

  return result;
};

const createPrismaTaxDocumentLifecyclePersistence = ({ db }) => {
  const tx = requireTransactionClient(db);

  const load = async (taxDocumentId) => {
    const id = String(taxDocumentId ?? '').trim();

    if (!id) {
      throw new TaxDocumentLifecyclePersistenceError(
        'INVALID_TAX_DOCUMENT_ID',
        'taxDocumentId is required',
      );
    }

    const aggregate = await tx.taxDocument.findUnique({
      where: { id },
      select: selectAggregate,
    });

    if (!aggregate) {
      throw new TaxDocumentLifecyclePersistenceError(
        'TAX_DOCUMENT_NOT_FOUND',
        'Tax document was not found',
        { taxDocumentId: id },
      );
    }

    return Object.freeze(aggregate);
  };

  const findReplay = async ({ taxDocumentId, commandKey }) => {
    if (!commandKey) return null;

    return tx.taxDocumentEvent.findFirst({
      where: {
        taxDocumentId,
        metadata: {
          path: ['commandKey'],
          equals: commandKey,
        },
      },
      orderBy: { performedAt: 'asc' },
      select: {
        id: true,
        eventType: true,
        performedAt: true,
        metadata: true,
      },
    });
  };

  const persist = async (inputResult) => {
    const result = validateTransitionResult(inputResult);
    const { aggregate, event } = result;
    const taxDocumentId = String(aggregate.id);
    const commandKey = event.metadata?.commandKey || null;
    const expectedVersion = event.aggregateVersion - 1;

    const existingEvent = await findReplay({ taxDocumentId, commandKey });

    if (existingEvent) {
      const currentAggregate = await load(taxDocumentId);
      return Object.freeze({
        written: false,
        replayed: true,
        taxDocument: currentAggregate,
        event: existingEvent,
      });
    }

    const update = await tx.taxDocument.updateMany({
      where: {
        id: taxDocumentId,
        version: expectedVersion,
      },
      data: {
        status: aggregate.status,
        version: aggregate.version,
        ...lifecycleTimestampData(event),
      },
    });

    if (update.count !== 1) {
      const replayAfterConflict = await findReplay({
        taxDocumentId,
        commandKey,
      });

      if (replayAfterConflict) {
        const currentAggregate = await load(taxDocumentId);
        return Object.freeze({
          written: false,
          replayed: true,
          taxDocument: currentAggregate,
          event: replayAfterConflict,
        });
      }

      const current = await tx.taxDocument.findUnique({
        where: { id: taxDocumentId },
        select: { id: true, version: true, status: true },
      });

      if (!current) {
        throw new TaxDocumentLifecyclePersistenceError(
          'TAX_DOCUMENT_NOT_FOUND',
          'Tax document was not found during lifecycle persistence',
          { taxDocumentId },
        );
      }

      throw new TaxDocumentLifecycleRuntimeError(
        'TAX_DOCUMENT_VERSION_CONFLICT',
        'Tax document version changed before lifecycle persistence',
        {
          actualVersion: current.version,
          expectedVersion,
        },
      );
    }

    const persistedEvent = await tx.taxDocumentEvent.create({
      data: {
        taxDocumentId,
        eventType: event.eventType,
        performedBy: toPerformedBy(event.performedByEmployeeId),
        performedAt: event.occurredAt,
        metadata: {
          ...(event.metadata || {}),
          aggregateVersion: event.aggregateVersion,
          correlationId: event.correlationId,
        },
      },
      select: {
        id: true,
        eventType: true,
        performedAt: true,
        metadata: true,
      },
    });

    const persistedAggregate = await load(taxDocumentId);

    return Object.freeze({
      written: true,
      replayed: false,
      taxDocument: persistedAggregate,
      event: persistedEvent,
    });
  };

  return Object.freeze({ load, persist });
};

module.exports = {
  TaxDocumentLifecyclePersistenceError,
  createPrismaTaxDocumentLifecyclePersistence,
};
