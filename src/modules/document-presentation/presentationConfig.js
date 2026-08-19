'use strict';

const { toCanonicalDocumentCode } = require('./canonicalDocumentIdentity');
const { BLOCK_TYPES } = require('./presentationCapabilityRegistry');

const ALIGNMENTS = new Set(['left', 'center', 'right']);
const TYPOGRAPHY_TOKENS = new Set(['xs', 'sm', 'md', 'lg', 'xl']);
const SPACING_TOKENS = new Set(['none', 'xs', 'sm', 'md', 'lg', 'xl']);
const WIDTH_VARIANTS = new Set(['auto', 'narrow', 'half', 'wide', 'full']);
const LOGO_MIN = 24;
const LOGO_MAX = 180;
const LEGACY_LOGO_SIZES = Object.freeze({ sm: 40, md: 56, lg: 72, xl: 88 });

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const bool = (value) => (typeof value === 'boolean' ? value : undefined);
const compact = (value) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

const normalizeLogoSize = (value) => {
  const legacy = LEGACY_LOGO_SIZES[text(value, 8).toLowerCase()];
  const parsed = legacy ?? Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(LOGO_MAX, Math.max(LOGO_MIN, Math.round(parsed)));
};

const normalizeHeader = (source) => {
  if (!isObject(source)) return {};
  const alignment = text(source.textAlign, 12).toLowerCase();
  const logoPosition = text(source.logoPosition, 12).toLowerCase();
  const size = text(source.storeNameSize, 8).toLowerCase();
  return compact({
    showLogo: bool(source.showLogo),
    logoUrl: Object.prototype.hasOwnProperty.call(source, 'logoUrl') ? text(source.logoUrl, 2048) : undefined,
    logoPosition: ALIGNMENTS.has(logoPosition) ? logoPosition : undefined,
    logoSize: normalizeLogoSize(source.logoSize),
    textAlign: ALIGNMENTS.has(alignment) ? alignment : undefined,
    showStoreName: bool(source.showStoreName),
    storeName: Object.prototype.hasOwnProperty.call(source, 'storeName') ? text(source.storeName, 300) : undefined,
    storeNameSize: TYPOGRAPHY_TOKENS.has(size) ? size : undefined,
    showAddress: bool(source.showAddress),
    address: Object.prototype.hasOwnProperty.call(source, 'address') ? text(source.address, 500) : undefined,
    showPhone: bool(source.showPhone),
    phone: Object.prototype.hasOwnProperty.call(source, 'phone') ? text(source.phone, 120) : undefined,
    showTaxId: bool(source.showTaxId),
    taxId: Object.prototype.hasOwnProperty.call(source, 'taxId') ? text(source.taxId, 64) : undefined,
    showBranchLabel: bool(source.showBranchLabel),
    headerNote: Object.prototype.hasOwnProperty.call(source, 'headerNote') ? text(source.headerNote, 1000) : undefined,
  });
};

const normalizeTypography = (source) => {
  if (!isObject(source)) return {};
  const output = {};
  for (const [key, raw] of Object.entries(source)) {
    const token = text(raw, 8).toLowerCase();
    const cleanKey = text(key, 64).replace(/[^A-Za-z0-9_]/g, '');
    if (cleanKey && TYPOGRAPHY_TOKENS.has(token)) output[cleanKey] = token;
  }
  return output;
};

const normalizeBlock = (source, fallbackType) => {
  if (!isObject(source)) return null;
  const type = text(source.type || fallbackType, 64).toUpperCase();
  if (!BLOCK_TYPES.includes(type)) return null;
  const alignment = text(source.alignment, 12).toLowerCase();
  const spacing = text(source.spacing, 8).toLowerCase();
  const width = text(source.width, 12).toLowerCase();
  const typography = text(source.typography, 8).toLowerCase();
  return compact({
    type,
    visible: bool(source.visible),
    content: Object.prototype.hasOwnProperty.call(source, 'content') ? text(source.content, 4000) : undefined,
    alignment: ALIGNMENTS.has(alignment) ? alignment : undefined,
    spacing: SPACING_TOKENS.has(spacing) ? spacing : undefined,
    width: WIDTH_VARIANTS.has(width) ? width : undefined,
    typography: TYPOGRAPHY_TOKENS.has(typography) ? typography : undefined,
    order: Number.isInteger(Number(source.order)) ? Math.max(0, Math.min(999, Number(source.order))) : undefined,
  });
};

const normalizeBlocks = (source) => {
  if (!isObject(source)) return {};
  const output = {};
  for (const [key, raw] of Object.entries(source)) {
    const block = normalizeBlock(raw, key);
    if (block) output[block.type] = block;
  }
  return output;
};

const normalizeLayout = (source) => {
  if (!isObject(source)) return {};
  const spacing = text(source.spacing, 8).toLowerCase();
  const blockOrder = Array.isArray(source.blockOrder)
    ? [...new Set(source.blockOrder.map((item) => text(item, 64).toUpperCase()).filter((item) => BLOCK_TYPES.includes(item)))].slice(0, BLOCK_TYPES.length)
    : undefined;
  return compact({
    spacing: SPACING_TOKENS.has(spacing) ? spacing : undefined,
    blockOrder,
  });
};

const normalizePaymentAccountSelection = (source) => {
  if (!isObject(source)) return {};
  const ids = Array.isArray(source.accountIds)
    ? [...new Set(source.accountIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 20)
    : undefined;
  return compact({
    accountIds: ids,
    showBankName: bool(source.showBankName),
    showAccountName: bool(source.showAccountName),
    showAccountNumber: bool(source.showAccountNumber),
  });
};

const normalizeLayer = (source) => {
  if (!isObject(source)) return {};
  return compact({
    header: Object.prototype.hasOwnProperty.call(source, 'header') ? normalizeHeader(source.header) : undefined,
    typography: Object.prototype.hasOwnProperty.call(source, 'typography') ? normalizeTypography(source.typography) : undefined,
    blocks: Object.prototype.hasOwnProperty.call(source, 'blocks') ? normalizeBlocks(source.blocks) : undefined,
    layout: Object.prototype.hasOwnProperty.call(source, 'layout') ? normalizeLayout(source.layout) : undefined,
    paymentAccountSelection: Object.prototype.hasOwnProperty.call(source, 'paymentAccountSelection')
      ? normalizePaymentAccountSelection(source.paymentAccountSelection)
      : undefined,
  });
};

const bridgeV1DocumentHeaderConfig = (value) => {
  if (!isObject(value)) return undefined;
  const documents = {};
  if (isObject(value.documents)) {
    for (const [rawCode, header] of Object.entries(value.documents)) {
      const code = toCanonicalDocumentCode(rawCode);
      if (code) documents[code] = { header: normalizeHeader(header) };
    }
  }
  return {
    version: 2,
    shared: { header: normalizeHeader(value.default) },
    documents,
    compatibility: { sourceVersion: 1 },
  };
};

const normalizeDocumentPresentationConfig = (value) => {
  if (value === null) return null;
  if (!isObject(value)) return undefined;
  if (Number(value.version || 1) === 1) return bridgeV1DocumentHeaderConfig(value);
  if (Number(value.version) !== 2) return undefined;

  const documents = {};
  if (isObject(value.documents)) {
    for (const [rawCode, layer] of Object.entries(value.documents)) {
      const code = toCanonicalDocumentCode(rawCode);
      if (code) documents[code] = normalizeLayer(layer);
    }
  }

  return {
    version: 2,
    shared: normalizeLayer(value.shared),
    documents,
  };
};

const mergeObjects = (...sources) => {
  const output = {};
  for (const source of sources) {
    if (!isObject(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      output[key] = isObject(value) ? mergeObjects(output[key], value) : Array.isArray(value) ? [...value] : value;
    }
  }
  return output;
};

const resolveDocumentPresentation = ({ systemDefault, storeConfig, documentPurpose, perDocumentOverride, issuedSnapshot } = {}) => {
  if (isObject(issuedSnapshot?.presentation)) return structuredClone(issuedSnapshot.presentation);
  if (isObject(issuedSnapshot) && Number(issuedSnapshot.version) === 2) return structuredClone(issuedSnapshot);

  const system = normalizeDocumentPresentationConfig(systemDefault) || { version: 2, shared: {}, documents: {} };
  const store = normalizeDocumentPresentationConfig(storeConfig) || { version: 2, shared: {}, documents: {} };
  const code = toCanonicalDocumentCode(documentPurpose);
  const override = normalizeLayer(perDocumentOverride);

  return {
    version: 2,
    documentPurpose: code,
    resolved: mergeObjects(
      system.shared,
      code ? system.documents?.[code] : null,
      store.shared,
      code ? store.documents?.[code] : null,
      override,
    ),
  };
};

module.exports = {
  ALIGNMENTS,
  LOGO_MAX,
  LOGO_MIN,
  SPACING_TOKENS,
  TYPOGRAPHY_TOKENS,
  WIDTH_VARIANTS,
  bridgeV1DocumentHeaderConfig,
  mergeObjects,
  normalizeDocumentPresentationConfig,
  normalizeHeader,
  normalizeLayer,
  resolveDocumentPresentation,
};
