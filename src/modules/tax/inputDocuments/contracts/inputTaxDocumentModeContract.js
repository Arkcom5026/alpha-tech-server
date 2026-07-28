'use strict';

const INPUT_TAX_DOCUMENT_MODES = Object.freeze([
  'UNCLASSIFIED',
  'NOT_RECEIVED',
  'RECEIVED',
  'NON_VAT_DOCUMENT',
  'NO_INPUT_TAX_CLAIM',
]);

const LEGACY_INPUT_TAX_DOCUMENT_MODE_MAP = Object.freeze({
  RECEIVED_WITH_GOODS: 'RECEIVED',
});

const normalizeInputTaxDocumentMode = (value, fallback = 'UNCLASSIFIED') => {
  const normalized = String(value || '').trim().toUpperCase();
  const resolved = LEGACY_INPUT_TAX_DOCUMENT_MODE_MAP[normalized] || normalized || fallback;
  if (!INPUT_TAX_DOCUMENT_MODES.includes(resolved)) {
    throw Object.assign(new Error('Unsupported input tax document mode'), {
      code: 'INPUT_TAX_DOCUMENT_MODE_INVALID',
      statusCode: 400,
      details: { value: normalized || null },
    });
  }
  return resolved;
};

module.exports = Object.freeze({
  INPUT_TAX_DOCUMENT_MODES,
  LEGACY_INPUT_TAX_DOCUMENT_MODE_MAP,
  normalizeInputTaxDocumentMode,
});
