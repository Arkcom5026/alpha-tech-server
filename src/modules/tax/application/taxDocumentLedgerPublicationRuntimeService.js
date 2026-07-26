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

const requireDraft = (draft) => {
  if (!draft?.document || !draft?.source || !draft?.snapshot || !draft?.event) {
    throw new TaxDocumentContractError(
      'INVALID_TAX_DOCUMENT_LEDGER_PUBLICATION_DRAFT',
      'Tax document and ledger publication requires a complete tax document draft',
    );
  }

  return draft;
};

const createTaxDocumentLedgerPublicationRuntime = ({ db }) => {
  const transactionAuthority = requireTransactionAuthority(db);

  const publishDocumentAndLedger = async ({
    draft,
    postingDate = null,
    effectiveDate = null,
  }) => {
    const resolvedDraft = requireDraft(draft);

    return transactionAuthority.$transaction(async (tx) => {
      const documentPublisher = createPrismaTaxDocumentPublisher({ db: tx });
      const ledgerPublisher = createPrismaTaxLedgerPublisher({ db: tx });

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
    });
  };

  return Object.freeze({ publishDocumentAndLedger });
};

module.exports = {
  createTaxDocumentLedgerPublicationRuntime,
  requireDraft,
  requireTransactionAuthority,
};
