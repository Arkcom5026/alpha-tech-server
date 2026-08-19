'use strict';

const DOCUMENT_TYPE_ALIASES = Object.freeze({
  RECEIPT: 'SALE_RECEIPT',
  SHORT_TAX_RECEIPT: 'SHORT_TAX_INVOICE',
  SALE_SHORT_TAX_RECEIPT: 'SHORT_TAX_INVOICE',
});

const normalizeDocumentCode = (value) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[\s-]+/g, '_')
  .replace(/[^A-Z0-9_]/g, '')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 100);

const toCanonicalDocumentCode = (value) => {
  const normalized = normalizeDocumentCode(value);
  if (!normalized) return null;
  return DOCUMENT_TYPE_ALIASES[normalized] || normalized;
};

const aliasesForCanonicalDocumentCode = (value) => {
  const canonical = toCanonicalDocumentCode(value);
  if (!canonical) return Object.freeze([]);
  return Object.freeze(
    Object.entries(DOCUMENT_TYPE_ALIASES)
      .filter(([, target]) => target === canonical)
      .map(([alias]) => alias),
  );
};

module.exports = {
  DOCUMENT_TYPE_ALIASES,
  aliasesForCanonicalDocumentCode,
  normalizeDocumentCode,
  toCanonicalDocumentCode,
};
