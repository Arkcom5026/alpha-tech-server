const TAX_DOCUMENT_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  CANCELLED: 'CANCELLED',
});

const TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES = Object.freeze({
  ISSUED: 'ISSUED',
  CANCELLED: 'CANCELLED',
  CREDIT_NOTE_CREATED: 'CREDIT_NOTE_CREATED',
  DEBIT_NOTE_CREATED: 'DEBIT_NOTE_CREATED',
});

class TaxDocumentLifecycleTransitionError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = 'TaxDocumentLifecycleTransitionError';
    this.code = code;
    this.details = details;
  }
}

const assertStatus = (status) => {
  if (!Object.values(TAX_DOCUMENT_STATUSES).includes(status)) {
    throw new TaxDocumentLifecycleTransitionError(
      'UNKNOWN_TAX_DOCUMENT_STATUS',
      'Unknown tax document status',
      { status },
    );
  }
};

const assertCanIssue = (status) => {
  assertStatus(status);

  if (status !== TAX_DOCUMENT_STATUSES.DRAFT) {
    throw new TaxDocumentLifecycleTransitionError(
      'TAX_DOCUMENT_CANNOT_BE_ISSUED',
      'Only a DRAFT tax document can be issued',
      { status },
    );
  }
};

const assertCanCancel = (status) => {
  assertStatus(status);

  if (status !== TAX_DOCUMENT_STATUSES.ISSUED) {
    throw new TaxDocumentLifecycleTransitionError(
      'TAX_DOCUMENT_CANNOT_BE_CANCELLED',
      'Only an ISSUED tax document can be cancelled',
      { status },
    );
  }
};

const assertCanCreateAdjustment = (status, adjustmentType) => {
  assertStatus(status);

  if (status !== TAX_DOCUMENT_STATUSES.ISSUED) {
    throw new TaxDocumentLifecycleTransitionError(
      'TAX_DOCUMENT_ADJUSTMENT_NOT_ALLOWED',
      `${adjustmentType} can only be created from an ISSUED tax document`,
      { status, adjustmentType },
    );
  }
};

module.exports = {
  TAX_DOCUMENT_LIFECYCLE_EVENT_TYPES,
  TAX_DOCUMENT_STATUSES,
  TaxDocumentLifecycleTransitionError,
  assertCanCancel,
  assertCanCreateAdjustment,
  assertCanIssue,
};
