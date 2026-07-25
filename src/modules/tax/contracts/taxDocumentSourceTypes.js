const TAX_DOCUMENT_SOURCE_TYPES = Object.freeze({
  SALE: 'SALE',
  PURCHASE_RECEIPT: 'PURCHASE_RECEIPT',
});

const TAX_DOCUMENT_TYPES = Object.freeze({
  TAX_INVOICE: 'TAX_INVOICE',
  ABBREVIATED_TAX_INVOICE: 'ABBREVIATED_TAX_INVOICE',
  RECEIPT_TAX_INVOICE: 'RECEIPT_TAX_INVOICE',
  CREDIT_NOTE: 'CREDIT_NOTE',
  DEBIT_NOTE: 'DEBIT_NOTE',
});

const TAX_DOCUMENT_DIRECTIONS = Object.freeze({
  OUTPUT: 'OUTPUT',
  INPUT: 'INPUT',
});

const isTaxDocumentSourceType = (value) =>
  Object.values(TAX_DOCUMENT_SOURCE_TYPES).includes(value);

const isTaxDocumentType = (value) =>
  Object.values(TAX_DOCUMENT_TYPES).includes(value);

const isTaxDocumentDirection = (value) =>
  Object.values(TAX_DOCUMENT_DIRECTIONS).includes(value);

module.exports = {
  TAX_DOCUMENT_SOURCE_TYPES,
  TAX_DOCUMENT_TYPES,
  TAX_DOCUMENT_DIRECTIONS,
  isTaxDocumentSourceType,
  isTaxDocumentType,
  isTaxDocumentDirection,
};
