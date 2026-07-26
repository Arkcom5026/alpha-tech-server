const TAX_DOCUMENT_TYPES = Object.freeze([
  'TAX_INVOICE',
  'RECEIPT_TAX_INVOICE',
  'ABBREVIATED_TAX_INVOICE',
  'CREDIT_NOTE',
  'DEBIT_NOTE',
  'INPUT_TAX_INVOICE',
]);

const TAX_DOCUMENT_STATUSES = Object.freeze([
  'DRAFT',
  'ISSUED',
  'VOIDED',
  'REPLACED',
]);

const TAX_SNAPSHOT_VERSION = 1;

const isSupportedTaxDocumentType = (value) =>
  TAX_DOCUMENT_TYPES.includes(String(value || '').trim().toUpperCase());

module.exports = {
  TAX_DOCUMENT_TYPES,
  TAX_DOCUMENT_STATUSES,
  TAX_SNAPSHOT_VERSION,
  isSupportedTaxDocumentType,
};
