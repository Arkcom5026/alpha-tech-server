class TaxAuthoritySubmissionPersistenceError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxAuthoritySubmissionPersistenceError';
    this.code = code;
    this.details = details;
  }
}

const requireTransactionClient = (db) => {
  const requiredModels = ['taxAuthoritySubmission', 'taxAuthoritySubmissionEvent'];
  const missingModels = requiredModels.filter((modelName) => !db?.[modelName]);

  if (missingModels.length > 0) {
    throw new TaxAuthoritySubmissionPersistenceError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_PERSISTENCE_CLIENT',
      'Tax authority submission persistence requires a Prisma transaction client',
      { missingModels },
    );
  }

  return db;
};

const validateTransitionResult = (result) => {
  if (!result?.aggregate || !result?.event) {
    throw new TaxAuthoritySubmissionPersistenceError(
      'INVALID_TAX_AUTHORITY_SUBMISSION_TRANSITION_RESULT',
      'Submission transition result must contain aggregate and event',
    );
  }

  if (String(result.aggregate.id) !== String(result.event.aggregateId)) {
    throw new TaxAuthoritySubmissionPersistenceError(
      'TAX_AUTHORITY_SUBMISSION_IDENTITY_MISMATCH',
      'Submission aggregate and event target different submissions',
    );
  }

  if (result.aggregate.version !== result.event.aggregateVersion) {
    throw new TaxAuthoritySubmissionPersistenceError(
      'TAX_AUTHORITY_SUBMISSION_VERSION_MISMATCH',
      'Submission aggregate and event versions must match',
    );
  }

  return result;
};

const createPrismaTaxAuthoritySubmissionPersistence = ({ db }) => {
  const tx = requireTransactionClient(db);

  const load = async (submissionId) => {
    const id = String(submissionId ?? '').trim();
    if (!id) {
      throw new TaxAuthoritySubmissionPersistenceError(
        'INVALID_TAX_AUTHORITY_SUBMISSION_ID',
        'submissionId is required',
      );
    }

    const aggregate = await tx.taxAuthoritySubmission.findUnique({ where: { id } });
    if (!aggregate) {
      throw new TaxAuthoritySubmissionPersistenceError(
        'TAX_AUTHORITY_SUBMISSION_NOT_FOUND',
        'Tax authority submission was not found',
        { submissionId: id },
      );
    }

    return Object.freeze(aggregate);
  };

  const findReplay = ({ submissionId, commandKey }) => {
    if (!commandKey) return null;
    return tx.taxAuthoritySubmissionEvent.findFirst({
      where: {
        submissionId,
        metadata: { path: ['commandKey'], equals: commandKey },
      },
      orderBy: { occurredAt: 'asc' },
    });
  };

  const persist = async (inputResult) => {
    const result = validateTransitionResult(inputResult);
    const { aggregate, event } = result;
    const submissionId = String(aggregate.id);
    const commandKey = event.metadata?.commandKey || null;
    const expectedVersion = event.aggregateVersion - 1;

    const replay = await findReplay({ submissionId, commandKey });
    if (replay) {
      return Object.freeze({
        written: false,
        replayed: true,
        submission: await load(submissionId),
        event: replay,
      });
    }

    const update = await tx.taxAuthoritySubmission.updateMany({
      where: { id: submissionId, version: expectedVersion },
      data: {
        status: aggregate.status,
        version: aggregate.version,
        updatedAt: event.occurredAt,
      },
    });

    if (update.count !== 1) {
      const current = await tx.taxAuthoritySubmission.findUnique({ where: { id: submissionId } });
      if (!current) {
        throw new TaxAuthoritySubmissionPersistenceError(
          'TAX_AUTHORITY_SUBMISSION_NOT_FOUND',
          'Tax authority submission was not found during persistence',
          { submissionId },
        );
      }

      throw new TaxAuthoritySubmissionPersistenceError(
        'TAX_AUTHORITY_SUBMISSION_VERSION_CONFLICT',
        'Submission version changed before persistence',
        { actualVersion: current.version, expectedVersion },
      );
    }

    const persistedEvent = await tx.taxAuthoritySubmissionEvent.create({
      data: {
        submissionId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        performedByEmployeeId: event.performedByEmployeeId ?? null,
        correlationId: event.correlationId ?? null,
        metadata: {
          ...(event.metadata || {}),
          aggregateVersion: event.aggregateVersion,
          taxDocumentId: event.taxDocumentId,
          providerKey: event.providerKey,
        },
      },
    });

    return Object.freeze({
      written: true,
      replayed: false,
      submission: await load(submissionId),
      event: persistedEvent,
    });
  };

  return Object.freeze({ load, findReplay, persist });
};

module.exports = {
  TaxAuthoritySubmissionPersistenceError,
  createPrismaTaxAuthoritySubmissionPersistence,
};
