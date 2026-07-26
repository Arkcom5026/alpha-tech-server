const {
  TaxDocumentContractError,
} = require('../contracts/createTaxDocumentCommand');

const {
  projectTaxDocumentDraftToLedgerEntry,
} = require('../projections/taxLedgerEntryProjection');

const {
  createPrismaTaxDocumentPublisher,
} = require('../infrastructure/prismaTaxDocumentPublisher');

const {
  createPrismaTaxLedgerPublisher,
} = require('../infrastructure/prismaTaxLedgerPublisher');

const requireTransactionAuthority = (db) => {
  if (!db || typeof db.$transaction !== 'function') {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PUBLICATION_TRANSACTION_AUTHORITY',
      'Tax document and ledger publication requires db.$transaction(callback)',
    );
  }

  return db;
};

const requireTransactionClient = (tx) => {
  const requiredModels = [
    'taxDocument',
    'taxDocumentSource',
    'taxDocumentEvent',
    'taxLedgerEntry',
  ];
  const missingModels = requiredModels.filter((modelName) => !tx?.[modelName]);

  if (missingModels.length > 0) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_PUBLICATION_TRANSACTION_CLIENT',
      'Tax publication requires an active Prisma transaction client',
      { missingModels },
    );
  }

  return tx;
};

const requireDraft = (draft) => {
  if (!draft?.document || !draft?.source || !draft?.snapshot || !draft?.event) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_LEDGER_PUBLICATION_DRAFT',
      'Tax document and ledger publication requires a complete tax document draft',
    );
  }

  return draft;
};

const publishDocumentAndLedgerInTransaction = async ({
  tx,
  draft,
  postingDate = null,
  effectiveDate = null,
}) => {
  const transactionClient = requireTransactionClient(tx);
  const resolvedDraft = requireDraft(draft);
  const documentPublisher = createPrismaTaxDocumentPublisher({ db: transactionClient });
  const ledgerPublisher = createPrismaTaxLedgerPublisher({ db: transactionClient });

  const documentPublication = await documentPublisher.publish(resolvedDraft);
  const taxDocument = documentPublication?.taxDocument;

  if (!taxDocument?.id) {
    throw new TaxDocumentContractError(
      'TAX_DOCUMENT_PUBLICATION_RESULT_MISSING',
      'Tax document publication must return the persisted tax document',
    );
  }

  const ledgerEntryDraft = projectTaxDocumentDraftToLedgerEntry({
    taxDocument,
    draft: resolvedDraft,
    postingDate,
    effectiveDate,
  });

  const ledgerPublication = await ledgerPublisher.publish(ledgerEntryDraft);

  return Object.freeze({
    documentPublication,
    ledgerEntryDraft,
    ledgerPublication,
  });
};

const createTaxDocumentLedgerPublicationRuntime = ({ db }) => {
  const transactionAuthority = requireTransactionAuthority(db);

  const publishDocumentAndLedger = async (input) =>
    transactionAuthority.$transaction((tx) =>
      publishDocumentAndLedgerInTransaction({ tx, ...input }),
    );

  return Object.freeze({ publishDocumentAndLedger });
};

module.exports = {
  createTaxDocumentLedgerPublicationRuntime,
  publishDocumentAndLedgerInTransaction,
  requireDraft,
  requireTransactionAuthority,
  requireTransactionClient,
};
