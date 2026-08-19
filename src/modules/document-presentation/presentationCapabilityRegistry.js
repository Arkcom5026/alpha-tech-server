'use strict';

const OWNERSHIP = Object.freeze({
  SYSTEM: 'SYSTEM_OWNED',
  STORE: 'STORE_OWNED',
  DOCUMENT: 'DOCUMENT_OWNED',
});

const RENDERER_FAMILIES = Object.freeze({
  A4: 'A4',
  THERMAL_80MM: 'THERMAL_80MM',
});

const BLOCK_TYPES = Object.freeze([
  'STORE_HEADER',
  'DOCUMENT_META',
  'PARTY',
  'ITEM_TABLE',
  'TOTALS',
  'COMMERCIAL_TERMS',
  'PAYMENT_TERMS',
  'DELIVERY_TERMS',
  'PAYMENT_ACCOUNT',
  'NOTES',
  'SIGNATURES',
  'SYSTEM_NOTICE',
  'CUSTOM_FOOTER',
]);

const profile = ({ className, rendererFamilies, storeBlocks = [], protectedBlocks = [] }) => Object.freeze({
  className,
  rendererFamilies: Object.freeze([...rendererFamilies]),
  storeBlocks: Object.freeze([...storeBlocks]),
  protectedBlocks: Object.freeze([...protectedBlocks]),
});

const COMMERCIAL = profile({
  className: 'COMMERCIAL',
  rendererFamilies: [RENDERER_FAMILIES.A4],
  storeBlocks: ['STORE_HEADER', 'COMMERCIAL_TERMS', 'PAYMENT_TERMS', 'DELIVERY_TERMS', 'PAYMENT_ACCOUNT', 'NOTES', 'SIGNATURES', 'CUSTOM_FOOTER'],
  protectedBlocks: ['DOCUMENT_META', 'PARTY', 'ITEM_TABLE', 'TOTALS'],
});

const STATUTORY_A4 = profile({
  className: 'STATUTORY',
  rendererFamilies: [RENDERER_FAMILIES.A4],
  storeBlocks: ['STORE_HEADER', 'NOTES', 'SIGNATURES', 'CUSTOM_FOOTER'],
  protectedBlocks: ['DOCUMENT_META', 'PARTY', 'ITEM_TABLE', 'TOTALS', 'SYSTEM_NOTICE'],
});

const STATUTORY_THERMAL = profile({
  className: 'STATUTORY',
  rendererFamilies: [RENDERER_FAMILIES.THERMAL_80MM],
  storeBlocks: ['STORE_HEADER', 'CUSTOM_FOOTER'],
  protectedBlocks: ['DOCUMENT_META', 'PARTY', 'ITEM_TABLE', 'TOTALS', 'SYSTEM_NOTICE'],
});

const FINANCE_MIXED = profile({
  className: 'FINANCE_OPERATIONAL',
  rendererFamilies: [RENDERER_FAMILIES.A4, RENDERER_FAMILIES.THERMAL_80MM],
  storeBlocks: ['STORE_HEADER', 'NOTES', 'SIGNATURES', 'CUSTOM_FOOTER'],
  protectedBlocks: ['DOCUMENT_META', 'PARTY', 'TOTALS', 'SYSTEM_NOTICE'],
});

const DOCUMENT_CAPABILITIES = Object.freeze({
  QUOTATION: COMMERCIAL,
  DELIVERY_NOTE: COMMERCIAL,
  PURCHASE_ORDER: COMMERCIAL,
  COMBINED_BILLING: COMMERCIAL,
  FULL_TAX_INVOICE: STATUTORY_A4,
  CREDIT_NOTE: STATUTORY_A4,
  SHORT_TAX_INVOICE: STATUTORY_THERMAL,
  SALE_RECEIPT: FINANCE_MIXED,
  CUSTOMER_RECEIPT: FINANCE_MIXED,
  CUSTOMER_MONEY_RECEIPT: FINANCE_MIXED,
  DELIVERY_CREDIT_SETTLEMENT: FINANCE_MIXED,
  REFUND_RECEIPT: FINANCE_MIXED,
});

const getDocumentPresentationCapability = (canonicalCode) => DOCUMENT_CAPABILITIES[canonicalCode] || null;

const canStoreConfigureBlock = (canonicalCode, blockType) => {
  const capability = getDocumentPresentationCapability(canonicalCode);
  return Boolean(capability?.storeBlocks.includes(blockType));
};

module.exports = {
  BLOCK_TYPES,
  DOCUMENT_CAPABILITIES,
  OWNERSHIP,
  RENDERER_FAMILIES,
  canStoreConfigureBlock,
  getDocumentPresentationCapability,
};
