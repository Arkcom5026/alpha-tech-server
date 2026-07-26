const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const requireTransactionClient = (db) => {
  const requiredModels = [
    'taxDocument',
    'taxDocumentSource',
    'taxDocumentEvent',
  ];

  const missingModels = requiredModels.filter(
    (modelName) => !db?.[modelName],
  );

  if (missingModels.length > 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PERSISTENCE_CLIENT',
      'Tax persistence requires a Prisma transaction client',
      { missingModels },
    );
  }

  return db;
};

const toPerformedBy = (value) => {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
};

const assertReplayBranch = ({ draft, existingTaxDocument }) => {
  if (!existingTaxDocument) return;

  if (existingTaxDocument.branchId !== draft.document.branchId) {
    throw new TaxDocumentContractError(
      'TAX_DOCUMENT_SOURCE_BRANCH_MISMATCH',
      'Tax document source is already owned by another branch',
      {
        sourceType: draft.source.sourceType,
        sourceId: draft.source.sourceId,
        requestedBranchId: draft.document.branchId,
        existingBranchId: existingTaxDocument.branchId,
        taxDocumentId: existingTaxDocument.id,
      },
    );
  }
};

const createPrismaTaxDocumentPublisher = ({ db }) => {
  const tx = requireTransactionClient(db);

  const publish = async (draft) => {
    if (!draft?.document || !draft?.source || !draft?.event) {
      throw new TaxDocumentContractError(
        'INVALID_TAX_DOCUMENT_DRAFT',
        'Tax document draft is incomplete',
      );
    }

    const existingSource = await tx.taxDocumentSource.findFirst({
      where: {
        sourceType: draft.source.sourceType,
        sourceId: draft.source.sourceId,
      },
      select: {
        taxDocument: {
          select: {
            id: true,
            branchId: true,
            documentNumber: true,
            documentType: true,
            status: true,
            version: true,
          },
        },
      },
    });

    assertReplayBranch({
      draft,
      existingTaxDocument: existingSource?.taxDocument || null,
    });

    if (existingSource?.taxDocument) {
      return Object.freeze({
        created: false,
        replayed: true,
        taxDocument: existingSource.taxDocument,
      });
    }

    const taxDocument = await tx.taxDocument.create({
      data: {
        branchId: draft.document.branchId,
        documentNumber: draft.document.documentNumber,
        documentType: draft.document.documentType,
        status: draft.document.status,
        version: draft.document.version,
        sources: {
          create: {
            sourceType: draft.source.sourceType,
            sourceId: draft.source.sourceId,
          },
        },
        events: {
          create: {
            eventType: draft.event.eventType,
            performedBy: toPerformedBy(
              draft.event.performedByEmployeeId,
            ),
            performedAt: draft.event.occurredAt,
            metadata: {
              ...(draft.event.metadata || {}),
              identityKey: draft.identityKey,
              contentHash: draft.contentHash,
            },
          },
        },
      },
      select: {
        id: true,
        branchId: true,
        documentNumber: true,
        documentType: true,
        status: true,
        version: true,
      },
    });

    return Object.freeze({
      created: true,
      replayed: false,
      taxDocument,
    });
  };

  return Object.freeze({ publish });
};

module.exports = {
  assertReplayBranch,
  createPrismaTaxDocumentPublisher,
};
